const config = require('../../config');

/**
 * Normalize a phone number to WhatsApp format
 * @param {string} phone - Phone number in various formats
 * @returns {string} - Normalized phone number (digits only with country code)
 */
function normalizePhoneNumber(phone) {
    if (!phone) return null;

    // Remove all non-digit characters except +
    let cleaned = phone.toString().replace(/[^\d+]/g, '');

    // Remove leading +
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }

    // If number doesn't start with country code, add default
    // Assuming Indian numbers are 10 digits
    if (cleaned.length === 10) {
        cleaned = config.defaultCountryCode + cleaned;
    }

    return cleaned;
}

/**
 * Convert phone number to WhatsApp chat ID format
 * @param {string} phone - Phone number
 * @returns {string} - WhatsApp chat ID (number@c.us)
 */
function toWhatsAppId(phone) {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) return null;
    return `${normalized}@c.us`;
}

/**
 * Extract phone number from WhatsApp chat ID
 * @param {string} chatId - WhatsApp chat ID
 * @returns {string} - Phone number
 */
function fromWhatsAppId(chatId) {
    if (!chatId) return null;
    return chatId.replace('@c.us', '').replace('@s.whatsapp.net', '');
}

/**
 * Validate phone number format
 * @param {string} phone - Phone number
 * @returns {boolean} - True if valid
 */
function isValidPhoneNumber(phone) {
    const normalized = normalizePhoneNumber(phone);
    if (!normalized) return false;

    // Should be at least 10 digits (with country code, typically 11-15)
    return normalized.length >= 10 && normalized.length <= 15;
}

module.exports = {
    normalizePhoneNumber,
    toWhatsAppId,
    fromWhatsAppId,
    isValidPhoneNumber
};
