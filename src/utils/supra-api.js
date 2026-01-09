const logger = require('./logger');

/**
 * API Client for Supra Travels PHP Backend
 * Calls the PHP API hosted on supratravels.gt.tc
 */
class SupraApiClient {
    constructor() {
        this.baseUrl = process.env.SUPRA_API_URL || 'https://supratravels.gt.tc/api/bot.php';
        this.apiKey = process.env.SUPRA_API_KEY || 'supra_bot_api_key_2024';
    }

    async makeRequest(action, params = {}) {
        try {
            const url = new URL(this.baseUrl);
            url.searchParams.append('action', action);
            url.searchParams.append('api_key', this.apiKey);

            for (const [key, value] of Object.entries(params)) {
                url.searchParams.append(key, value);
            }

            logger.debug(`API Request: ${action}`, params);

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'X-API-Key': this.apiKey
                },
                timeout: 10000
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            logger.debug(`API Response: ${action}`, data);
            return data;
        } catch (error) {
            logger.error(`Supra API error (${action}):`, error.message);
            return null;
        }
    }

    /**
     * Get all active routes
     */
    async getRoutes() {
        return await this.makeRequest('routes');
    }

    /**
     * Get today's schedule
     */
    async getSchedule() {
        return await this.makeRequest('schedule');
    }

    /**
     * Check seat availability
     * @param {number} routeId - Route ID (1 for Blr->Hosd, 2 for Hosd->Blr)
     * @param {string} date - Date in YYYY-MM-DD format
     */
    async checkAvailability(routeId = 1, date = null) {
        if (!date) {
            date = new Date().toISOString().split('T')[0];
        }
        return await this.makeRequest('availability', { route: routeId, date });
    }

    /**
     * Look up booking by phone number
     * @param {string} phone - Customer phone number
     */
    async lookupBooking(phone) {
        // Clean phone number
        phone = phone.replace(/[^0-9]/g, '');
        if (phone.length > 10) {
            phone = phone.slice(-10);
        }
        return await this.makeRequest('booking', { phone });
    }

    /**
     * Get pricing info
     */
    async getPricing() {
        return await this.makeRequest('pricing');
    }

    /**
     * Format booking info for WhatsApp message
     */
    formatBookingResponse(data) {
        if (!data || !data.success) {
            return "❌ Sorry, couldn't check booking status. Please try again later or call +91 96860 20017.";
        }

        if (!data.found) {
            return "❌ No booking found for this phone number.\n\n🎫 To book: supratravels.gt.tc/booking.php\n📞 Call: +91 96860 20017";
        }

        let message = `✅ Found ${data.count} booking(s):\n\n`;

        for (const booking of data.bookings) {
            message += `📋 *Booking #${booking.id}*\n`;
            message += `👤 ${booking.name}\n`;
            message += `🛣️ ${booking.route}\n`;
            message += `📅 ${booking.date}\n`;
            message += `🪑 Seats: ${booking.seats}\n`;
            message += `💰 ₹${booking.amount}\n`;
            message += `📊 Status: ${booking.status}\n`;
            if (booking.transaction_id) {
                message += `🔢 Txn: ${booking.transaction_id}\n`;
            }
            message += '\n';
        }

        message += "Need help? Call +91 96860 20017";
        return message;
    }

    /**
     * Format availability info for WhatsApp message
     */
    formatAvailabilityResponse(data) {
        if (!data || !data.success) {
            return "❌ Couldn't check availability. Please try again later.";
        }

        let message = `🚌 *Seat Availability*\n\n`;
        message += `🛣️ Route: ${data.route}\n`;
        message += `📅 Date: ${data.date}\n`;
        message += `🪑 Available: ${data.available} / ${data.total_seats} seats\n`;
        message += `📊 Status: ${data.status}\n\n`;

        if (data.available > 0) {
            message += `🎫 Book now: supratravels.gt.tc/booking.php`;
        } else {
            message += `😔 Fully booked! Try another date or call +91 96860 20017`;
        }

        return message;
    }

    /**
     * Format schedule info for WhatsApp message
     */
    formatScheduleResponse(data) {
        if (!data || !data.success) {
            return "❌ Couldn't get schedule. Please try again later.";
        }

        let message = `🕐 *Today's Schedule (${data.date})*\n\n`;

        for (const trip of data.schedule) {
            message += `🚌 ${trip.route}\n`;
            message += `   ⏰ Departure: ${trip.departure}\n`;
            message += `   ⏱️ Arrival: ${trip.arrival}\n`;
            if (trip.bus) message += `   🚍 Bus: ${trip.bus}\n`;
            message += '\n';
        }

        message += `🎫 Book: supratravels.gt.tc`;
        return message;
    }
}

// Singleton instance
const supraApi = new SupraApiClient();

module.exports = supraApi;
