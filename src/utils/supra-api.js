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
                    'X-API-Key': this.apiKey,
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Connection': 'keep-alive',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 10000
            });

            if (!response.ok) {
                const errorText = await response.text();
                logger.error(`API status error: ${response.status}`, { text: errorText.substring(0, 200) });
                throw new Error(`API error: ${response.status}`);
            }

            const responseText = await response.text();
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (e) {
                logger.error('Failed to parse JSON response', { text: responseText.substring(0, 200) });
                throw new Error('Invalid JSON response from server');
            }

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
     * Format booking info for WhatsApp message (ticket-style)
     */
    formatBookingResponse(data) {
        if (!data || !data.success) {
            return "❌ Sorry, couldn't check booking status.\n\n📞 Please call: +91 96860 20017";
        }

        if (!data.found) {
            return `❌ *No booking found for your number*

🎫 *Want to book a ticket?*
🌐 https://supratravels.gt.tc/booking.php

📞 Or call: +91 96860 20017`;
        }

        let message = `✅ *Found ${data.count} Booking(s)*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

        for (const booking of data.bookings) {
            // Status emoji
            const statusEmoji = booking.status.toLowerCase() === 'confirmed' ? '✅' :
                booking.status.toLowerCase() === 'pending' ? '⏳' : '❌';

            message += `🎫 *TICKET #${booking.id}*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `👤 *Passenger:* ${booking.name}\n`;
            message += `🛣️ *Route:* ${booking.route}\n`;
            message += `📅 *Travel Date:* ${this.formatDate(booking.date)}\n`;
            message += `🪑 *Seat(s):* ${booking.seats}\n`;
            message += `💰 *Amount:* ₹${booking.amount}\n`;
            message += `${statusEmoji} *Status:* ${booking.status}\n`;
            if (booking.transaction_id) {
                message += `🔢 *Txn ID:* ${booking.transaction_id}\n`;
            }
            message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }

        message += `📞 Need help? Call +91 96860 20017\n`;
        message += `🌐 supratravels.gt.tc`;
        return message;
    }

    /**
     * Format date to readable format
     */
    formatDate(dateStr) {
        try {
            const date = new Date(dateStr);
            const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
            return date.toLocaleDateString('en-IN', options);
        } catch (e) {
            return dateStr;
        }
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
