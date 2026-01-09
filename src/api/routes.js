const express = require('express');
const router = express.Router();
const whatsappClient = require('../whatsapp/client');
const { getAutoReplyConfig, updateAutoReplyConfig, setKeyword, removeKeyword } = require('../whatsapp/handlers');
const { isValidPhoneNumber, normalizePhoneNumber } = require('../utils/phone');
const aiService = require('../utils/ai');
const logger = require('../utils/logger');

/**
 * Health check endpoint for Railway
 */
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * Get WhatsApp connection status
 */
router.get('/status', (req, res) => {
    const status = whatsappClient.getStatus();
    res.json({
        whatsapp: status,
        autoReply: getAutoReplyConfig().enabled,
        ai: aiService.getConfig()
    });
});

/**
 * Get QR code for authentication
 */
router.get('/qr', async (req, res) => {
    const status = whatsappClient.getStatus();

    if (status.isReady) {
        return res.json({
            success: false,
            message: 'Already connected',
            connection: status.connection
        });
    }

    if (!status.hasQrCode) {
        return res.json({
            success: false,
            message: 'QR code not available. Please wait or check logs.'
        });
    }

    const qrDataUrl = await whatsappClient.getQrCodeDataUrl();

    if (req.query.format === 'html') {
        // Return HTML page with QR code
        return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp QR Code</title>
        <meta http-equiv="refresh" content="30">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            display: flex; 
            flex-direction: column;
            align-items: center; 
            justify-content: center; 
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
            color: white;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            text-align: center;
          }
          h1 { color: #128C7E; margin-bottom: 10px; }
          p { color: #666; margin-bottom: 20px; }
          img { border-radius: 10px; }
          .refresh { color: #999; font-size: 12px; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📱 Scan QR Code</h1>
          <p>Open WhatsApp on your phone → Settings → Linked Devices → Link a Device</p>
          <img src="${qrDataUrl}" alt="WhatsApp QR Code" width="300" height="300">
          <p class="refresh">Page auto-refreshes every 30 seconds</p>
        </div>
      </body>
      </html>
    `);
    }

    res.json({
        success: true,
        qrCode: qrDataUrl
    });
});

/**
 * Send a message to a phone number
 */
router.post('/send', async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'Phone and message are required'
            });
        }

        if (!isValidPhoneNumber(phone)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid phone number format'
            });
        }

        const result = await whatsappClient.sendMessage(phone, message);

        res.json({
            success: true,
            ...result,
            normalizedPhone: normalizePhoneNumber(phone)
        });
    } catch (error) {
        logger.error('Send message error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Send message to multiple recipients
 */
router.post('/send-bulk', async (req, res) => {
    try {
        const { phones, message } = req.body;

        if (!phones || !Array.isArray(phones) || phones.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Phones array is required'
            });
        }

        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }

        const results = [];
        for (const phone of phones) {
            try {
                if (!isValidPhoneNumber(phone)) {
                    results.push({ phone, success: false, error: 'Invalid phone number' });
                    continue;
                }

                const result = await whatsappClient.sendMessage(phone, message);
                results.push({ phone, success: true, ...result });

                // Small delay between messages to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                results.push({ phone, success: false, error: error.message });
            }
        }

        res.json({
            success: true,
            results,
            summary: {
                total: phones.length,
                sent: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length
            }
        });
    } catch (error) {
        logger.error('Bulk send error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get auto-reply configuration
 */
router.get('/auto-reply', (req, res) => {
    res.json({
        success: true,
        config: getAutoReplyConfig()
    });
});

/**
 * Update auto-reply configuration
 */
router.put('/auto-reply', (req, res) => {
    try {
        const config = updateAutoReplyConfig(req.body);
        res.json({
            success: true,
            config
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Add or update a keyword
 */
router.post('/auto-reply/keyword', (req, res) => {
    const { keyword, reply } = req.body;

    if (!keyword) {
        return res.status(400).json({
            success: false,
            error: 'Keyword is required'
        });
    }

    setKeyword(keyword, reply);

    res.json({
        success: true,
        message: `Keyword '${keyword}' ${reply === null ? 'set to no-reply' : 'updated'}`
    });
});

/**
 * Remove a keyword
 */
router.delete('/auto-reply/keyword/:keyword', (req, res) => {
    const { keyword } = req.params;

    removeKeyword(keyword);

    res.json({
        success: true,
        message: `Keyword '${keyword}' removed`
    });
});

/**
 * Get AI configuration
 */
router.get('/ai', (req, res) => {
    res.json({
        success: true,
        config: aiService.getConfig()
    });
});

/**
 * Update AI system prompt
 */
router.put('/ai/prompt', (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({
            success: false,
            error: 'Prompt is required'
        });
    }

    aiService.setSystemPrompt(prompt);

    res.json({
        success: true,
        message: 'System prompt updated',
        config: aiService.getConfig()
    });
});

/**
 * Test AI response
 */
router.post('/ai/test', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }

    if (!aiService.isEnabled()) {
        return res.status(400).json({
            success: false,
            error: 'AI is not configured. Set OPENROUTER_API_KEY or GOOGLE_API_KEY in environment variables.'
        });
    }

    try {
        const reply = await aiService.generateReply(message);
        res.json({
            success: true,
            input: message,
            reply: reply
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
