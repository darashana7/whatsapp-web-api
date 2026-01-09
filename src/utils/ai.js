const logger = require('./logger');

/**
 * AI Service for generating smart replies
 * Supports: OpenRouter (many models) and Google Gemini API
 */
class AIService {
    constructor() {
        this.provider = null;
        this.apiKey = null;
        this.model = null;
        this.systemPrompt = `You are a friendly customer service assistant for Supra Tour and Travels on WhatsApp.

=== FORMATTING RULES (IMPORTANT!) ===
1. Use WhatsApp formatting: *bold* for important info
2. Use emojis at start of sections (🚌 🎫 📅 💰 📞 ✅ ❌)
3. Keep responses SHORT (max 400 characters)
4. Use line breaks for readability
5. Use bullet points with • or numbered lists
6. Always include a call-to-action at the end

=== RESPONSE STRUCTURE ===
Start with greeting + emoji
Then main info in organized format
End with: booking link or phone number

=== COMPANY INFO ===
• Supra Tour and Travels Pvt Ltd
• Location: Hosadurga, Karnataka - 577527
• Phone: +91 96860 20017
• Website: supratravels.gt.tc

=== SERVICES ===
🚌 *Bus Service:* Bangalore ⇄ Hosadurga (daily)
💰 *Special:* ₹999 round-trip pass!
🚗 *Rentals:* Mini buses, Tempo Travelers
✈️ *Travel Desk:* Flights, Trains, Hotels

=== TOUR PACKAGES ===
• Coorg - 3D/2N
• Hampi - 2D/1N  
• Chikmagalur - 2D/1N
• Tirupati - Custom
• Dharmasthala - 2D/1N

=== EXAMPLE GOOD RESPONSES ===

For booking query:
"🎫 *Your Booking*

📅 Date: Jan 15, 2024
🚌 Route: Bangalore → Hosadurga  
🪑 Seats: A1, A2
💰 Amount: ₹999

✅ Status: Confirmed

Need help? Call +91 96860 20017"

For availability:
"🚌 *Seat Availability*

📅 Tomorrow (Jan 10)
🪑 Available: 32/45 seats
💰 Price: ₹509 one-way

🎫 Book now: supratravels.gt.tc"

=== RULES ===
• If you have LIVE DATA, use exact numbers/dates from it
• Never make up booking details
• Always be helpful and professional
• Promote the ₹999 round-trip offer when relevant`;

        this.initialize();
    }

    initialize() {
        // Store both API keys for runtime switching
        this.openrouterKey = process.env.OPENROUTER_API_KEY || null;
        this.openrouterModel = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';
        this.googleKey = process.env.GOOGLE_API_KEY || null;
        this.googleModel = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';

        // Priority: OpenRouter > Google Gemini
        if (this.openrouterKey) {
            this.provider = 'openrouter';
            this.apiKey = this.openrouterKey;
            this.model = this.openrouterModel;
            logger.info(`AI Service initialized with OpenRouter (${this.model})`);
        } else if (this.googleKey) {
            this.provider = 'google';
            this.apiKey = this.googleKey;
            this.model = this.googleModel;
            logger.info(`AI Service initialized with Google Gemini (${this.model})`);
        } else {
            logger.info('AI Service: No API key configured. Using keyword-based replies.');
        }
    }

    /**
     * Switch AI provider at runtime
     * @param {string} newProvider - 'openrouter' or 'google'
     * @returns {object} - Result with success status
     */
    setProvider(newProvider) {
        if (newProvider === 'openrouter') {
            if (!this.openrouterKey) {
                return { success: false, error: 'OpenRouter API key not configured' };
            }
            this.provider = 'openrouter';
            this.apiKey = this.openrouterKey;
            this.model = this.openrouterModel;
            logger.info(`AI Provider switched to OpenRouter (${this.model})`);
        } else if (newProvider === 'google') {
            if (!this.googleKey) {
                return { success: false, error: 'Google API key not configured' };
            }
            this.provider = 'google';
            this.apiKey = this.googleKey;
            this.model = this.googleModel;
            logger.info(`AI Provider switched to Google Gemini (${this.model})`);
        } else if (newProvider === 'disabled') {
            this.provider = null;
            this.apiKey = null;
            logger.info('AI Provider disabled');
        } else {
            return { success: false, error: 'Invalid provider. Use: openrouter, google, or disabled' };
        }

        return {
            success: true,
            provider: this.provider,
            model: this.model,
            message: `Switched to ${newProvider}`
        };
    }

    /**
     * Get available providers
     */
    getAvailableProviders() {
        const providers = ['disabled'];
        if (this.openrouterKey) providers.push('openrouter');
        if (this.googleKey) providers.push('google');
        return providers;
    }

    isEnabled() {
        return this.provider !== null && this.apiKey !== null;
    }

    /**
     * Get current AI configuration
     */
    getConfig() {
        return {
            enabled: this.isEnabled(),
            provider: this.provider,
            model: this.model,
            hasOpenRouter: !!this.openrouterKey,
            hasGoogle: !!this.googleKey
        };
    }

    /**
     * Generate AI response for a message
     * @param {string} userMessage - The user's message
     * @param {string} senderName - Optional sender name for context
     * @param {object} liveData - Optional live data from database
     * @returns {Promise<string|null>} - AI response or null on error
     */
    async generateReply(userMessage, senderName = null, liveData = null) {
        if (!this.isEnabled()) {
            logger.debug('AI Service not enabled - no API key configured');
            return null;
        }

        try {
            // Build context with live data if available
            let contextMessage = userMessage;
            if (liveData) {
                contextMessage = `USER MESSAGE: ${userMessage}\n\n`;
                contextMessage += `LIVE DATABASE INFO (use this to respond accurately):\n`;
                contextMessage += JSON.stringify(liveData, null, 2);
                contextMessage += `\n\nRespond to the user using the above live data. Be specific with numbers, dates, and details from the data.`;
            }

            logger.debug(`AI generating reply for: "${userMessage.substring(0, 50)}..."`);
            if (liveData) {
                logger.debug(`AI has live data context: ${Object.keys(liveData).join(', ')}`);
            }

            if (this.provider === 'openrouter') {
                return await this.callOpenRouter(contextMessage, senderName);
            } else if (this.provider === 'google') {
                return await this.callGoogleGemini(contextMessage, senderName);
            }
        } catch (error) {
            logger.error(`AI Service error: ${error.message}`);
            // Return null to fallback to keyword replies
            return null;
        }
    }

    async callOpenRouter(userMessage, senderName) {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.SITE_URL || 'https://whatsapp-bot.railway.app',
                'X-Title': 'WhatsApp AI Bot'
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    { role: 'system', content: this.systemPrompt },
                    { role: 'user', content: senderName ? `[From: ${senderName}] ${userMessage}` : userMessage }
                ],
                max_tokens: 300,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    }

    async callGoogleGemini(userMessage, senderName) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const prompt = senderName
            ? `${this.systemPrompt}\n\n[From: ${senderName}] ${userMessage}`
            : `${this.systemPrompt}\n\n${userMessage}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: prompt }]
                }],
                generationConfig: {
                    maxOutputTokens: 300,
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Google Gemini API error: ${response.status} - ${error}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }

    /**
     * Update the system prompt
     * @param {string} prompt - New system prompt
     */
    setSystemPrompt(prompt) {
        this.systemPrompt = prompt;
        logger.info('AI system prompt updated');
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            enabled: this.isEnabled(),
            provider: this.provider,
            model: this.model,
            systemPrompt: this.systemPrompt
        };
    }
}

// Singleton instance
const aiService = new AIService();

module.exports = aiService;
