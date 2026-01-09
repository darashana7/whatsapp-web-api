<?php
/**
 * Supra Travels WhatsApp Bot API
 * 
 * This API allows the WhatsApp bot to query booking data,
 * check seat availability, and get route information.
 * 
 * Upload this file to: supratravels.gt.tc/api/bot.php
 */

// Enable CORS for Railway bot
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// API Key for security (set this in the bot's environment variables)
define('API_KEY', 'supra_bot_api_key_2024');

// Database configuration - uses same config as existing admin
require_once('../admin/config.php');

// Verify API key
function verifyApiKey() {
    $headers = getallheaders();
    $apiKey = isset($headers['X-API-Key']) ? $headers['X-API-Key'] : 
              (isset($_GET['api_key']) ? $_GET['api_key'] : null);
    
    if ($apiKey !== API_KEY) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized', 'message' => 'Invalid API key']);
        exit;
    }
}

// Get database connection
function getDB() {
    global $conn;
    if (!$conn) {
        http_response_code(500);
        echo json_encode(['error' => 'Database connection failed']);
        exit;
    }
    return $conn;
}

// Get all active routes with pricing
function getRoutes() {
    $conn = getDB();
    $sql = "SELECT id, source, destination, departure_time, arrival_time, 
            one_way_price, return_price, status 
            FROM routes WHERE status = 'active' ORDER BY id";
    $result = $conn->query($sql);
    
    $routes = [];
    while ($row = $result->fetch_assoc()) {
        $routes[] = [
            'id' => $row['id'],
            'route' => $row['source'] . ' → ' . $row['destination'],
            'source' => $row['source'],
            'destination' => $row['destination'],
            'departure' => $row['departure_time'],
            'arrival' => $row['arrival_time'],
            'one_way_price' => $row['one_way_price'],
            'return_price' => $row['return_price']
        ];
    }
    
    return ['success' => true, 'routes' => $routes];
}

// Get today's schedule
function getSchedule() {
    $conn = getDB();
    $today = date('Y-m-d');
    
    $sql = "SELECT r.source, r.destination, r.departure_time, r.arrival_time,
            b.name as bus_name, d.name as driver_name
            FROM routes r
            LEFT JOIN buses b ON r.bus_id = b.id
            LEFT JOIN drivers d ON r.driver_id = d.id
            WHERE r.status = 'active'
            ORDER BY r.departure_time";
    $result = $conn->query($sql);
    
    $schedule = [];
    while ($row = $result->fetch_assoc()) {
        $schedule[] = [
            'route' => $row['source'] . ' → ' . $row['destination'],
            'departure' => $row['departure_time'],
            'arrival' => $row['arrival_time'],
            'bus' => $row['bus_name'],
            'driver' => $row['driver_name']
        ];
    }
    
    return ['success' => true, 'date' => $today, 'schedule' => $schedule];
}

// Check seat availability for a specific date and route
function checkAvailability($routeId, $date) {
    $conn = getDB();
    
    // Get total seats for the route's bus
    $sql = "SELECT b.total_seats, r.source, r.destination 
            FROM routes r 
            JOIN buses b ON r.bus_id = b.id 
            WHERE r.id = ?";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("i", $routeId);
    $stmt->execute();
    $result = $stmt->get_result();
    $route = $result->fetch_assoc();
    
    if (!$route) {
        return ['success' => false, 'error' => 'Route not found'];
    }
    
    $totalSeats = $route['total_seats'] ?: 45;
    
    // Get booked seats for this date
    $sql = "SELECT seat_numbers FROM bookings 
            WHERE route_id = ? AND travel_date = ? AND status != 'cancelled'";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("is", $routeId, $date);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $bookedSeats = [];
    while ($row = $result->fetch_assoc()) {
        $seats = explode(',', $row['seat_numbers']);
        $bookedSeats = array_merge($bookedSeats, $seats);
    }
    
    $bookedCount = count(array_unique($bookedSeats));
    $available = $totalSeats - $bookedCount;
    
    return [
        'success' => true,
        'route' => $route['source'] . ' → ' . $route['destination'],
        'date' => $date,
        'total_seats' => $totalSeats,
        'booked' => $bookedCount,
        'available' => $available,
        'status' => $available > 0 ? 'Available' : 'Full'
    ];
}

// Look up booking by phone number
function lookupBooking($phone) {
    $conn = getDB();
    
    // Clean phone number
    $phone = preg_replace('/[^0-9]/', '', $phone);
    if (strlen($phone) > 10) {
        $phone = substr($phone, -10);
    }
    
    $sql = "SELECT b.*, r.source, r.destination, r.departure_time 
            FROM bookings b
            JOIN routes r ON b.route_id = r.id
            WHERE b.phone LIKE ?
            ORDER BY b.travel_date DESC
            LIMIT 5";
    
    $phonePattern = '%' . $phone;
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("s", $phonePattern);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $bookings = [];
    while ($row = $result->fetch_assoc()) {
        $bookings[] = [
            'id' => $row['id'],
            'name' => $row['name'],
            'route' => $row['source'] . ' → ' . $row['destination'],
            'date' => $row['travel_date'],
            'departure' => $row['departure_time'],
            'seats' => $row['seat_numbers'],
            'amount' => $row['amount'],
            'status' => ucfirst($row['status']),
            'transaction_id' => $row['transaction_id']
        ];
    }
    
    if (empty($bookings)) {
        return [
            'success' => true,
            'found' => false,
            'message' => 'No bookings found for this phone number'
        ];
    }
    
    return [
        'success' => true,
        'found' => true,
        'count' => count($bookings),
        'bookings' => $bookings
    ];
}

// Get pricing info
function getPricing() {
    $conn = getDB();
    
    $sql = "SELECT source, destination, one_way_price, return_price 
            FROM routes WHERE status = 'active'";
    $result = $conn->query($sql);
    
    $pricing = [];
    while ($row = $result->fetch_assoc()) {
        $pricing[] = [
            'route' => $row['source'] . ' ⇄ ' . $row['destination'],
            'one_way' => '₹' . $row['one_way_price'],
            'return' => '₹' . $row['return_price']
        ];
    }
    
    return [
        'success' => true,
        'special_offer' => '₹999 Round-trip pass!',
        'pricing' => $pricing
    ];
}

// Main router
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Public endpoints (no API key needed)
$publicActions = ['health'];

if (!in_array($action, $publicActions)) {
    verifyApiKey();
}

switch ($action) {
    case 'health':
        echo json_encode([
            'status' => 'ok',
            'service' => 'Supra Travels Bot API',
            'timestamp' => date('c')
        ]);
        break;
        
    case 'routes':
        echo json_encode(getRoutes());
        break;
        
    case 'schedule':
        echo json_encode(getSchedule());
        break;
        
    case 'availability':
        $routeId = isset($_GET['route']) ? intval($_GET['route']) : 1;
        $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');
        echo json_encode(checkAvailability($routeId, $date));
        break;
        
    case 'booking':
        $phone = isset($_GET['phone']) ? $_GET['phone'] : '';
        if (empty($phone)) {
            echo json_encode(['error' => 'Phone number required']);
        } else {
            echo json_encode(lookupBooking($phone));
        }
        break;
        
    case 'pricing':
        echo json_encode(getPricing());
        break;
        
    default:
        echo json_encode([
            'error' => 'Invalid action',
            'available_actions' => ['health', 'routes', 'schedule', 'availability', 'booking', 'pricing']
        ]);
}
?>
