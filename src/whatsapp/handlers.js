const config = require('../../config');
const logger = require('../utils/logger');
const supraApi = require('../utils/supra-api');
const { fromWhatsAppId } = require('../utils/phone');

// Track cooldown for each sender
const cooldownMap = new Map();

// Track conversation state (for menu-driven flow)
const conversationState = new Map();

// Runtime auto-reply configuration
let autoReplyConfig = {
    enabled: config.autoReply.enabled,
    useDatabase: true,
    defaultMessage: config.autoReply.defaultMessage,
    cooldown: config.autoReply.cooldown
};

// Main menu message
const MAIN_MENU = `🙏 *Welcome to Supra Travels!*

Please reply with a number:

1️⃣ Check my booking status
2️⃣ Book a new ticket
3️⃣ Check seat availability
4️⃣ Bus schedule & timings
5️⃣ Contact support

🌐 Website: supratravels.gt.tc`;

// Menu option responses
const MENU_RESPONSES = {
    '1': 'CHECK_BOOKING',
    '2': `🎫 *Book Your Bus Ticket Now!*

🌐 *Online Booking:*
https://supratravels.gt.tc/booking.php

📍 Route: Bangalore ⇄ Hosadurga
💰 Round-trip: Just ₹999!

📞 *Or Call to Book:*
+91 96860 20017

We're here to help! 🙏`,
    '3': 'CHECK_AVAILABILITY',
    '4': 'CHECK_SCHEDULE',
    '5': `📞 *Contact Supra Travels*

☎️ Phone: +91 96860 20017
📧 Email: info@supratravels.in

📍 Address:
Supra Tour and Travels Pvt Ltd
Hosadurga, Chitradurga District
Karnataka - 577527

🌐 supratravels.gt.tc

We're available 7 AM - 10 PM daily! 🙏`
};

/**
 * Setup message handlers on WhatsApp client
 */
function setupMessageHandlers(client) {
    client.on('message', async (message) => {
        try {
            await handleIncomingMessage(message);
        } catch (error) {
            logger.error('Error handling message:', error);
        }
    });

    client.on('message_create', async (message) => {
        if (message.fromMe) {
            const to = fromWhatsAppId(message.to);
            logger.info(`📤 Message sent to ${to}: ${message.body.substring(0, 50)}...`);
        }
    });

    logger.info('Message handlers registered (Bus Booking Mode)');
}

/**
 * Handle incoming messages with menu-driven flow
 */
async function handleIncomingMessage(message) {
    // Skip if from self or group
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return;

    const sender = fromWhatsAppId(message.from);
    const messageText = message.body.trim();
    const messageTextLower = messageText.toLowerCase();

    logger.info(`📥 Message from ${sender}: ${messageText.substring(0, 100)}`);

    // Check if auto-reply is enabled
    if (!autoReplyConfig.enabled) {
        logger.debug('Auto-reply disabled, skipping');
        return;
    }

    // Check cooldown
    if (isOnCooldown(sender)) {
        logger.debug(`Sender ${sender} is on cooldown, skipping reply`);
        return;
    }

    // Skip acknowledgement words
    const skipWords = ['ok', 'okay', 'yes', 'no', 'hmm', 'k', 'fine', 'good', 'nice', 'great', 'thanks', 'thank you', 'thankyou', 'tq', 'ty'];
    if (skipWords.includes(messageTextLower)) {
        logger.debug('Acknowledgement word, sending thank you');
        if (messageTextLower.includes('thank')) {
            await message.reply('🙏 Thank you for choosing Supra Travels! Safe travels! 🚌');
            setCooldown(sender);
        }
        return;
    }

    let replyMessage = null;

    // 1. Check for menu option (single digit 1-5)
    if (['1', '2', '3', '4', '5'].includes(messageText)) {
        replyMessage = await handleMenuOption(messageText, sender);
    }
    // 2. Check for greetings - show main menu
    else if (isGreeting(messageTextLower)) {
        replyMessage = MAIN_MENU;
    }
    // 3. Check for booking-related keywords
    else if (isBookingQuery(messageTextLower)) {
        replyMessage = await lookupSenderBooking(sender);
    }
    // 4. Check for availability keywords
    else if (isAvailabilityQuery(messageTextLower)) {
        replyMessage = await checkAvailabilityForQuery(messageTextLower);
    }
    // 5. Check for schedule/timing keywords
    else if (isScheduleQuery(messageTextLower)) {
        replyMessage = await getScheduleResponse();
    }
    // 6. Check for new booking keywords
    else if (isNewBookingQuery(messageTextLower)) {
        replyMessage = MENU_RESPONSES['2'];
    }
    // 7. Check for contact/help keywords
    else if (isContactQuery(messageTextLower)) {
        replyMessage = MENU_RESPONSES['5'];
    }
    // 8. Default - show menu
    else {
        replyMessage = `🤔 I didn't understand that. Let me help you!\n\n${MAIN_MENU}`;
    }

    // Send reply
    if (replyMessage) {
        try {
            await message.reply(replyMessage);
            logger.info(`🤖 Replied to ${sender}`);
            setCooldown(sender);
        } catch (error) {
            logger.error(`Failed to send reply to ${sender}:`, error);
        }
    }
}

/**
 * Handle menu option selection
 */
async function handleMenuOption(option, senderPhone) {
    const response = MENU_RESPONSES[option];

    if (response === 'CHECK_BOOKING') {
        return await lookupSenderBooking(senderPhone);
    }
    if (response === 'CHECK_AVAILABILITY') {
        return await checkAvailabilityForQuery('today');
    }
    if (response === 'CHECK_SCHEDULE') {
        return await getScheduleResponse();
    }

    return response;
}

/**
 * Look up booking for the sender's phone number
 */
async function lookupSenderBooking(phone) {
    logger.info(`📊 Looking up booking for ${phone}`);
    try {
        const data = await supraApi.lookupBooking(phone);
        if (data) {
            return supraApi.formatBookingResponse(data);
        }
    } catch (error) {
        logger.error(`Booking lookup error: ${error.message}`);
    }
    return `❌ Sorry, couldn't check booking status right now.\n\n📞 Please call: +91 96860 20017`;
}

/**
 * Check availability based on query
 */
async function checkAvailabilityForQuery(query) {
    let date = new Date().toISOString().split('T')[0];
    let routeId = 1; // Default: Bangalore -> Hosadurga

    if (query.includes('tomorrow')) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        date = tomorrow.toISOString().split('T')[0];
    }

    if (query.includes('hosadurga to') || query.includes('from hosadurga')) {
        routeId = 2;
    }

    logger.info(`📊 Checking availability - route ${routeId}, date ${date}`);
    try {
        const data = await supraApi.checkAvailability(routeId, date);
        if (data) {
            return supraApi.formatAvailabilityResponse(data);
        }
    } catch (error) {
        logger.error(`Availability check error: ${error.message}`);
    }
    return `❌ Couldn't check availability right now.\n\n📞 Please call: +91 96860 20017`;
}

/**
 * Get schedule response
 */
async function getScheduleResponse() {
    logger.info(`📊 Getting schedule`);
    try {
        const data = await supraApi.getSchedule();
        if (data) {
            return supraApi.formatScheduleResponse(data);
        }
    } catch (error) {
        logger.error(`Schedule fetch error: ${error.message}`);
    }
    return `❌ Couldn't get schedule right now.\n\n📞 Please call: +91 96860 20017`;
}

// ============ Keyword Detection Helpers ============

function isGreeting(text) {
    const greetings = ['hi', 'hello', 'hey', 'hii', 'hiii', 'namaste', 'namaskar', 'namaskara', 'ನಮಸ್ಕಾರ'];
    return greetings.includes(text) || greetings.some(g => text.startsWith(g + ' '));
}

function isBookingQuery(text) {
    const keywords = ['booking', 'booked', 'my booking', 'my ticket', 'reservation', 'ticket status', 'booking status', 'check booking', 'my seat'];
    return keywords.some(k => text.includes(k));
}

function isAvailabilityQuery(text) {
    const keywords = ['available', 'availability', 'seats available', 'how many seats', 'seats left', 'is there seat', 'any seat'];
    return keywords.some(k => text.includes(k));
}

function isScheduleQuery(text) {
    const keywords = ['schedule', 'timing', 'timings', 'time', 'departure', 'arrive', 'when does', 'what time', 'bus time'];
    return keywords.some(k => text.includes(k));
}

function isNewBookingQuery(text) {
    const keywords = ['book', 'new booking', 'book ticket', 'book seat', 'want to book', 'need ticket', 'book bus'];
    return keywords.some(k => text.includes(k));
}

function isContactQuery(text) {
    const keywords = ['contact', 'call', 'phone', 'number', 'help', 'support', 'address', 'office'];
    return keywords.some(k => text.includes(k));
}

// ============ Cooldown Management ============

function isOnCooldown(sender) {
    const lastReply = cooldownMap.get(sender);
    if (!lastReply) return false;
    const elapsed = (Date.now() - lastReply) / 1000;
    return elapsed < autoReplyConfig.cooldown;
}

function setCooldown(sender) {
    cooldownMap.set(sender, Date.now());

    // Clean up old entries
    if (cooldownMap.size > 1000) {
        const cutoff = Date.now() - (autoReplyConfig.cooldown * 1000);
        for (const [key, value] of cooldownMap.entries()) {
            if (value < cutoff) cooldownMap.delete(key);
        }
    }
}

// ============ Config Management ============

function getAutoReplyConfig() {
    return { ...autoReplyConfig };
}

function updateAutoReplyConfig(newConfig) {
    if (typeof newConfig.enabled === 'boolean') {
        autoReplyConfig.enabled = newConfig.enabled;
    }
    if (typeof newConfig.useDatabase === 'boolean') {
        autoReplyConfig.useDatabase = newConfig.useDatabase;
    }
    if (typeof newConfig.cooldown === 'number') {
        autoReplyConfig.cooldown = newConfig.cooldown;
    }
    logger.info('Auto-reply configuration updated');
    return getAutoReplyConfig();
}

function setKeyword(keyword, reply) {
    // Not used in simplified version, kept for API compatibility
    logger.info(`Keyword setting not available in simplified mode`);
}

function removeKeyword(keyword) {
    // Not used in simplified version, kept for API compatibility
    logger.info(`Keyword removal not available in simplified mode`);
}

/**
 * Test function - simulates receiving a message and returns the bot's response
 * Used by /api/test-reply endpoint for desktop testing
 */
async function testReply(messageText, senderPhone = '9999999999') {
    const messageTextLower = messageText.trim().toLowerCase();

    // Skip acknowledgement words
    const skipWords = ['ok', 'okay', 'yes', 'no', 'hmm', 'k', 'fine', 'good', 'nice', 'great'];
    if (skipWords.includes(messageTextLower)) {
        return { reply: null, reason: 'Acknowledgement word - no reply' };
    }

    if (messageTextLower.includes('thank')) {
        return { reply: '🙏 Thank you for choosing Supra Travels! Safe travels! 🚌', reason: 'Thank you response' };
    }

    let replyMessage = null;
    let reason = '';

    // 1. Check for menu option (single digit 1-5)
    if (['1', '2', '3', '4', '5'].includes(messageText.trim())) {
        replyMessage = await handleMenuOption(messageText.trim(), senderPhone);
        reason = `Menu option ${messageText.trim()}`;
    }
    // 2. Check for greetings
    else if (isGreeting(messageTextLower)) {
        replyMessage = MAIN_MENU;
        reason = 'Greeting detected';
    }
    // 3. Check for booking-related keywords
    else if (isBookingQuery(messageTextLower)) {
        replyMessage = await lookupSenderBooking(senderPhone);
        reason = 'Booking query detected';
    }
    // 4. Check for availability keywords
    else if (isAvailabilityQuery(messageTextLower)) {
        replyMessage = await checkAvailabilityForQuery(messageTextLower);
        reason = 'Availability query detected';
    }
    // 5. Check for schedule/timing keywords
    else if (isScheduleQuery(messageTextLower)) {
        replyMessage = await getScheduleResponse();
        reason = 'Schedule query detected';
    }
    // 6. Check for new booking keywords
    else if (isNewBookingQuery(messageTextLower)) {
        replyMessage = MENU_RESPONSES['2'];
        reason = 'New booking query detected';
    }
    // 7. Check for contact/help keywords
    else if (isContactQuery(messageTextLower)) {
        replyMessage = MENU_RESPONSES['5'];
        reason = 'Contact/help query detected';
    }
    // 8. Default - show menu
    else {
        replyMessage = `🤔 I didn't understand that. Let me help you!\n\n${MAIN_MENU}`;
        reason = 'Default response';
    }

    return { reply: replyMessage, reason };
}

module.exports = {
    setupMessageHandlers,
    getAutoReplyConfig,
    updateAutoReplyConfig,
    setKeyword,
    removeKeyword,
    testReply
};
