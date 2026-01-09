const config = require('../../config');
const logger = require('../utils/logger');
const { fromWhatsAppId } = require('../utils/phone');

// Track cooldown for each sender
const cooldownMap = new Map();

// Runtime auto-reply configuration (can be updated via API)
let autoReplyConfig = {
    enabled: config.autoReply.enabled,
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
 * Handle incoming messages with auto-reply
 * @param {Object} message - WhatsApp message object
 */
async function handleIncomingMessage(message) {
    // Skip if from self or group
    if (message.fromMe) return;
    if (message.from.includes('@g.us')) return; // Skip group messages

    const sender = fromWhatsAppId(message.from);
    const messageText = message.body.toLowerCase().trim();

    logger.info(`📥 Message from ${sender}: ${message.body.substring(0, 100)}`);

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

    // Find matching keyword reply
    let replyMessage = findKeywordReply(messageText);

    // If no keyword match and we have a default message, use it
    if (replyMessage === undefined) {
        replyMessage = autoReplyConfig.defaultMessage;
    }

    // null means explicitly no reply (for acknowledgement words like "ok", "yes")
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
