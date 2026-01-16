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

// Polyfill for getallheaders() - needed for CGI/FastCGI PHP
if (!function_exists('getallheaders')) {
    function getallheaders() {
        $headers = [];
        foreach ($_SERVER as $name => $value) {
            if (substr($name, 0, 5) == 'HTTP_') {
                $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))))] = $value;
            }
        }
        return $headers;
    }
}

// API Key for security
define('API_KEY', 'supra_bot_api_key_2024');

// Database configuration
$configPath1 = dirname(__DIR__) . '/config.php';
$configPath2 = $_SERVER['DOCUMENT_ROOT'] . '/config.php';

$conn = null;

if (file_exists($configPath1)) {
    require_once($configPath1);
} elseif (file_exists($configPath2)) {
    require_once($configPath2);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'Database configuration not found']);
    exit;
}

if (!isset($conn) || !$conn) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Verify API key
function verifyApiKey() {
    $headers = getallheaders();
    $apiKey = isset($headers['X-Api-Key']) ? $headers['X-Api-Key'] : 
              (isset($headers['X-API-Key']) ? $headers['X-API-Key'] : 
              (isset($_GET['api_key']) ? $_GET['api_key'] : null));
    
    if ($apiKey !== API_KEY) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized', 'message' => 'Invalid API key']);
        exit;
    }
}

function getDB() {
    global $conn;
    return $conn;
}

// Get all active routes
function getRoutes() {
    $conn = getDB();
    $sql = "SELECT id, source, destination, departure_time, arrival_time, price 
            FROM routes ORDER BY id";
    $result = $conn->query($sql);
    
    $routes = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $routes[] = [
                'id' => $row['id'],
                'route' => $row['source'] . ' → ' . $row['destination'],
                'source' => $row['source'],
                'destination' => $row['destination'],
                'departure' => $row['departure_time'],
                'arrival' => $row['arrival_time'],
                'price' => $row['price']
            ];
        }
    }
    
    return ['success' => true, 'routes' => $routes];
}

// Get today's schedule
function getSchedule() {
    $conn = getDB();
    $today = date('Y-m-d');
    
    // Simple query matching your schema
    $sql = "SELECT source, destination, departure_time, arrival_time, price 
            FROM routes ORDER BY departure_time";
    $result = $conn->query($sql);
    
    $schedule = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $schedule[] = [
                'route' => $row['source'] . ' → ' . $row['destination'],
                'departure' => $row['departure_time'],
                'arrival' => $row['arrival_time'],
                'price' => '₹' . $row['price']
            ];
        }
    }
    
    return ['success' => true, 'date' => $today, 'schedule' => $schedule];
}

// Check seat availability for a specific date
function checkAvailability($routeName, $date) {
    $conn = getDB();
    
    // Get total seats (default 45)
    $totalSeats = 45;
    
    // Get booked seats for this date and route
    $sql = "SELECT seats FROM bookings 
            WHERE route LIKE ? AND travel_date = ? AND status != 'cancelled'";
    $routePattern = '%' . $routeName . '%';
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ss", $routePattern, $date);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $bookedSeats = [];
    while ($row = $result->fetch_assoc()) {
        $seats = explode(',', $row['seats']);
        $bookedSeats = array_merge($bookedSeats, $seats);
    }
    
    $bookedCount = count(array_unique($bookedSeats));
    $available = $totalSeats - $bookedCount;
    
    return [
        'success' => true,
        'route' => $routeName ?: 'Bangalore → Hosadurga',
        'date' => $date,
        'total_seats' => $totalSeats,
        'booked' => $bookedCount,
        'available' => max(0, $available),
        'status' => $available > 0 ? 'Available' : 'Full'
    ];
}

// Look up booking by phone number - MATCHES YOUR SCHEMA
function lookupBooking($phone) {
    $conn = getDB();
    
    // Clean phone number
    $phone = preg_replace('/[^0-9]/', '', $phone);
    if (strlen($phone) > 10) {
        $phone = substr($phone, -10);
    }
    
    // Query matching YOUR bookings table schema
    $sql = "SELECT id, route, travel_date, seats, customer_name, phone, status, total_amount, created_at 
            FROM bookings 
            WHERE phone LIKE ?
            ORDER BY travel_date DESC
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
            'name' => $row['customer_name'],
            'route' => $row['route'],
            'date' => $row['travel_date'],
            'seats' => $row['seats'],
            'amount' => $row['total_amount'],
            'status' => ucfirst($row['status']),
            'transaction_id' => null // Not in your schema
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
    
    $sql = "SELECT source, destination, price FROM routes";
    $result = $conn->query($sql);
    
    $pricing = [];
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $pricing[] = [
                'route' => $row['source'] . ' ⇄ ' . $row['destination'],
                'one_way' => '₹' . $row['price']
            ];
        }
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
        $route = isset($_GET['route']) ? $_GET['route'] : 'Bangalore';
        $date = isset($_GET['date']) ? $_GET['date'] : date('Y-m-d');
        echo json_encode(checkAvailability($route, $date));
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
