const config = require('../../config');
const logger = require('../utils/logger');
const aiService = require('../utils/ai');
const supraApi = require('../utils/supra-api');
const { fromWhatsAppId } = require('../utils/phone');

// Track cooldown for each sender
const cooldownMap = new Map();

// Runtime auto-reply configuration (can be updated via API)
let autoReplyConfig = {
    enabled: config.autoReply.enabled,
    useAI: true, // Use AI if available
    useDatabase: true, // Use database queries
    defaultMessage: config.autoReply.defaultMessage,
    keywords: { ...config.autoReply.keywords },
    cooldown: config.autoReply.cooldown
};

/**
 * Setup message handlers on WhatsApp client
 * @param {Object} client - WhatsApp client instance
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
        // Only log outgoing messages
        if (message.fromMe) {
            const to = fromWhatsAppId(message.to);
            logger.info(`📤 Message sent to ${to}: ${message.body.substring(0, 50)}...`);
        }
    });

    logger.info('Message handlers registered');
}

/**
 * Check for database query commands
 * @param {string} messageText - Original message text
 * @param {string} senderPhone - Sender's phone number
 * @returns {Promise<string|null>} - Response or null if not a DB command
 */
async function handleDatabaseQuery(messageText, senderPhone) {
    const textLower = messageText.toLowerCase();

    // Check booking status - expanded triggers
    if (textLower.includes('booking') ||
        textLower.includes('ticket') ||
        textLower.includes('reservation') ||
        textLower.includes('booked') ||
        textLower.includes('my seat')) {
        logger.info(`📊 DB Query: Checking booking for ${senderPhone}`);
        try {
            const data = await supraApi.lookupBooking(senderPhone);
            logger.info(`📊 DB Response: ${JSON.stringify(data)}`);
            if (data) {
                return supraApi.formatBookingResponse(data);
            }
        } catch (error) {
            logger.error(`📊 DB Error (booking): ${error.message}`);
        }
    }

    // Check seat availability - expanded triggers
    if (textLower.includes('seat') ||
        textLower.includes('available') ||
        textLower.includes('availability') ||
        textLower.includes('how many') ||
        textLower.includes('left')) {
        // Try to extract date from message
        let date = null;
        if (textLower.includes('tomorrow')) {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            date = tomorrow.toISOString().split('T')[0];
        } else if (textLower.includes('today')) {
            date = new Date().toISOString().split('T')[0];
        }

        // Try to detect route
        let routeId = 1; // Default: Bangalore -> Hosadurga
        if (textLower.includes('hosadurga to') || textLower.includes('from hosadurga')) {
            routeId = 2;
        }

        logger.info(`📊 DB Query: Checking availability - route ${routeId}, date ${date || 'today'}`);
        try {
            const data = await supraApi.checkAvailability(routeId, date);
            logger.info(`📊 DB Response: ${JSON.stringify(data)}`);
            if (data) {
                return supraApi.formatAvailabilityResponse(data);
            }
        } catch (error) {
            logger.error(`📊 DB Error (availability): ${error.message}`);
        }
    }

    // Get schedule - expanded triggers
    if (textLower.includes('schedule') ||
        textLower.includes('timing') ||
        textLower.includes('time') ||
        textLower.includes('when') ||
        textLower.includes('departure') ||
        textLower.includes('arrive')) {
        logger.info(`📊 DB Query: Getting schedule`);
        try {
            const data = await supraApi.getSchedule();
            logger.info(`📊 DB Response: ${JSON.stringify(data)}`);
            if (data) {
                return supraApi.formatScheduleResponse(data);
            }
        } catch (error) {
            logger.error(`📊 DB Error (schedule): ${error.message}`);
        }
    }

    return null; // Not a database query
}

/**
 * Handle incoming messages with auto-reply
 * @param {Object} message - WhatsApp message object
 */
async function handleIncomingMessage(message) {
    // Skip if from self or group
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return; // Skip group messages

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

    // Check for explicit no-reply keywords first (like "ok", "yes", etc.)
    if (autoReplyConfig.keywords.hasOwnProperty(messageTextLower) &&
        autoReplyConfig.keywords[messageTextLower] === null) {
        logger.debug('No reply configured for this message type');
        return;
    }

    let replyMessage = null;

    // 1. First try database queries (booking lookup, availability, etc.)
    if (autoReplyConfig.useDatabase) {
        try {
            replyMessage = await handleDatabaseQuery(messageText, sender);
            if (replyMessage) {
                logger.info(`📊 Database query response for ${sender}`);
            }
        } catch (error) {
            logger.error('Database query failed:', error.message);
        }
    }

    // 2. Try AI with live database context
    if (!replyMessage && autoReplyConfig.useAI && aiService.isEnabled()) {
        try {
            // Get contact name if available
            let senderName = null;
            try {
                const contact = await message.getContact();
                senderName = contact.pushname || contact.name || null;
            } catch (e) {
                // Ignore contact fetch errors
            }

            // Fetch relevant database data to give AI context
            let liveData = {};

            // Try to get booking info for this customer
            try {
                const bookingData = await supraApi.lookupBooking(sender);
                if (bookingData && bookingData.success) {
                    liveData.customerBookings = bookingData;
                    logger.info(`📊 Fetched booking data for AI context`);
                }
            } catch (e) {
                logger.debug(`Could not fetch booking: ${e.message}`);
            }

            // Try to get today's availability
            try {
                const availabilityData = await supraApi.checkAvailability(1);
                if (availabilityData && availabilityData.success) {
                    liveData.todayAvailability = availabilityData;
                    logger.info(`📊 Fetched availability data for AI context`);
                }
            } catch (e) {
                logger.debug(`Could not fetch availability: ${e.message}`);
            }

            // Try to get schedule
            try {
                const scheduleData = await supraApi.getSchedule();
                if (scheduleData && scheduleData.success) {
                    liveData.schedule = scheduleData;
                    logger.info(`📊 Fetched schedule data for AI context`);
                }
            } catch (e) {
                logger.debug(`Could not fetch schedule: ${e.message}`);
            }

            // Pass live data to AI if we got any
            const hasLiveData = Object.keys(liveData).length > 0;
            replyMessage = await aiService.generateReply(
                messageText,
                senderName,
                hasLiveData ? liveData : null
            );

            if (replyMessage) {
                logger.info(`🤖 AI generated reply for ${sender} (with${hasLiveData ? '' : 'out'} live data)`);
            }
        } catch (error) {
            logger.error('AI reply failed, falling back to keywords:', error.message);
        }
    }

    // 3. Fallback to keyword matching if AI didn't respond
    if (!replyMessage) {
        replyMessage = findKeywordReply(messageTextLower);

        // If no keyword match, use default message
        if (replyMessage === undefined) {
            replyMessage = autoReplyConfig.defaultMessage;
        }
    }

    // null means explicitly no reply
    if (replyMessage === null) {
        logger.debug('No reply configured for this message type');
        return;
    }

    // Send auto-reply
    if (replyMessage) {
        try {
            await message.reply(replyMessage);
            logger.info(`🤖 Auto-replied to ${sender}`);

            // Set cooldown
            setCooldown(sender);
        } catch (error) {
            logger.error(`Failed to send auto-reply to ${sender}:`, error);
        }
    }
}

/**
 * Find a matching keyword reply
 * @param {string} messageText - Lowercased message text
 * @returns {string|null|undefined} - Reply message, null for no-reply, undefined for no match
 */
function findKeywordReply(messageText) {
    // Check for exact keyword match first
    if (autoReplyConfig.keywords.hasOwnProperty(messageText)) {
        return autoReplyConfig.keywords[messageText];
    }

    // Check if message starts with any keyword
    for (const [keyword, reply] of Object.entries(autoReplyConfig.keywords)) {
        if (messageText.startsWith(keyword + ' ') || messageText.startsWith(keyword + ',')) {
            return reply;
        }
    }

    return undefined; // No match found
}

/**
 * Check if sender is on cooldown
 * @param {string} sender - Phone number
 * @returns {boolean}
 */
function isOnCooldown(sender) {
    const lastReply = cooldownMap.get(sender);
    if (!lastReply) return false;

    const elapsed = (Date.now() - lastReply) / 1000;
    return elapsed < autoReplyConfig.cooldown;
}

/**
 * Set cooldown for sender
 * @param {string} sender - Phone number
 */
function setCooldown(sender) {
    cooldownMap.set(sender, Date.now());

    // Clean up old entries periodically
    if (cooldownMap.size > 1000) {
        const cutoff = Date.now() - (autoReplyConfig.cooldown * 1000);
        for (const [key, value] of cooldownMap.entries()) {
            if (value < cutoff) {
                cooldownMap.delete(key);
            }
        }
    }
}

/**
 * Get current auto-reply configuration
 * @returns {Object}
 */
function getAutoReplyConfig() {
    return { ...autoReplyConfig };
}

/**
 * Update auto-reply configuration
 * @param {Object} newConfig - New configuration
 */
function updateAutoReplyConfig(newConfig) {
    if (typeof newConfig.enabled === 'boolean') {
        autoReplyConfig.enabled = newConfig.enabled;
    }
    if (typeof newConfig.defaultMessage === 'string') {
        autoReplyConfig.defaultMessage = newConfig.defaultMessage;
    }
    if (typeof newConfig.cooldown === 'number') {
        autoReplyConfig.cooldown = newConfig.cooldown;
    }
    if (typeof newConfig.keywords === 'object') {
        autoReplyConfig.keywords = { ...autoReplyConfig.keywords, ...newConfig.keywords };
    }

    logger.info('Auto-reply configuration updated');
    return getAutoReplyConfig();
}

/**
 * Add or update a keyword
 * @param {string} keyword - Keyword to match
 * @param {string|null} reply - Reply message (null for no-reply)
 */
function setKeyword(keyword, reply) {
    autoReplyConfig.keywords[keyword.toLowerCase()] = reply;
    logger.info(`Keyword '${keyword}' ${reply === null ? 'set to no-reply' : 'updated'}`);
}

/**
 * Remove a keyword
 * @param {string} keyword - Keyword to remove
 */
function removeKeyword(keyword) {
    delete autoReplyConfig.keywords[keyword.toLowerCase()];
    logger.info(`Keyword '${keyword}' removed`);
}

module.exports = {
    setupMessageHandlers,
    getAutoReplyConfig,
    updateAutoReplyConfig,
    setKeyword,
    removeKeyword
};
