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
        this.systemPrompt = `You are a friendly customer service assistant for Supra Tour and Travels. Keep responses concise, helpful, and under 500 characters. Use emojis occasionally.

COMPANY INFO:
- Supra Tour and Travels Pvt Ltd, Hosadurga, Karnataka - 577527
- Phone: +91 96860 20017 | Email: info@supratravels.in
- Website: https://supratravels.gt.tc

SERVICES:
1. Daily Bus Service: Bangalore ⇄ Hosadurga (via Hiriyur)
   - SPECIAL OFFER: Round-trip/Daily pass for ₹999 only!
   - Online seat booking available
2. Vehicle Rentals: Mini buses (17-32 seater), Tempo Travelers (12-17 seater), Luxury coaches
3. Corporate Travel: Employee transportation & event logistics
4. Travel Desk: Flight, Train (IRCTC), Hotel bookings, Visa assistance

TOUR PACKAGES:
- Coorg: 3 Days / 2 Nights
- Hampi Heritage Tour: 2 Days / 1 Night
- Chikmagalur Nature Trip: 2 Days / 1 Night
- Tirupati Darshan: Custom duration
- Dharmasthala & Kukke: 2 Days / 1 Night

BOOKING:
- Online: https://supratravels.gt.tc/booking.php
- WhatsApp: +91 96860 20017
- Get Quote: https://supratravels.gt.tc/quote.html

Always guide customers to book online or contact via phone. Be helpful, professional, and promote our ₹999 round-trip offer!`;

        this.initialize();
    }

    initialize() {
        // Priority: OpenRouter > Google Gemini
        if (process.env.OPENROUTER_API_KEY) {
            this.provider = 'openrouter';
            this.apiKey = process.env.OPENROUTER_API_KEY;
            this.model = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';
            logger.info(`AI Service initialized with OpenRouter (${this.model})`);
        } else if (process.env.GOOGLE_API_KEY) {
            this.provider = 'google';
            this.apiKey = process.env.GOOGLE_API_KEY;
            this.model = process.env.GOOGLE_MODEL || 'gemini-2.0-flash';
            logger.info(`AI Service initialized with Google Gemini (${this.model})`);
        } else {
            logger.info('AI Service: No API key configured. Using keyword-based replies.');
        }
    }

    isEnabled() {
        return this.provider !== null && this.apiKey !== null;
    }

    /**
     * Generate AI response for a message
     * @param {string} userMessage - The user's message
     * @param {string} senderName - Optional sender name for context
     * @returns {Promise<string|null>} - AI response or null on error
     */
    async generateReply(userMessage, senderName = null) {
        if (!this.isEnabled()) {
            logger.debug('AI Service not enabled - no API key configured');
            return null;
        }

        try {
            logger.debug(`AI generating reply for: "${userMessage.substring(0, 50)}..."`);

            if (this.provider === 'openrouter') {
                return await this.callOpenRouter(userMessage, senderName);
            } else if (this.provider === 'google') {
                return await this.callGoogleGemini(userMessage, senderName);
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
