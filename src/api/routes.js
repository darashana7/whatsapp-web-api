const express = require('express');
const router = express.Router();
const whatsappClient = require('../whatsapp/client');
const { getAutoReplyConfig, updateAutoReplyConfig, setKeyword, removeKeyword, testReply } = require('../whatsapp/handlers');
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
        config: aiService.getConfig(),
        availableProviders: aiService.getAvailableProviders()
    });
});

/**
 * Switch AI provider
 */
router.put('/ai/provider', (req, res) => {
    const { provider } = req.body;

    if (!provider) {
        return res.status(400).json({
            success: false,
            error: 'Provider is required (openrouter, google, or disabled)'
        });
    }

    const result = aiService.setProvider(provider);

    if (result.success) {
        res.json({
            success: true,
            ...result,
            config: aiService.getConfig()
        });
    } else {
        res.status(400).json(result);
    }
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
        const reply = await aiService.generateReply(message, null, null, true);
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

/**
 * Test bot reply - simulates receiving a message
 */
router.post('/test-reply', async (req, res) => {
    const { message, phone } = req.body;

    if (!message) {
        return res.status(400).json({
            success: false,
            error: 'Message is required'
        });
    }

    try {
        const result = await testReply(message, phone || '9999999999');
        res.json({
            success: true,
            input: message,
            phone: phone || '9999999999',
            ...result
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Test page - HTML interface for testing bot
 */
router.get('/test', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>WhatsApp Bot Tester</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #075E54 0%, #128C7E 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: #ECE5DD;
            border-radius: 10px;
            overflow: hidden;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }
        .header {
            background: #075E54;
            color: white;
            padding: 15px 20px;
            display: flex;
            align-items: center;
            gap: 15px;
        }
        .header .avatar {
            width: 40px;
            height: 40px;
            background: #25D366;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }
        .header h1 { font-size: 18px; font-weight: 500; }
        .header small { opacity: 0.8; font-size: 12px; }
        .chat {
            height: 400px;
            overflow-y: auto;
            padding: 15px;
            background: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAIUlEQVQoU2NkYGD4z4AEGBkZQRQDKRYYMGIwjiJyKgQAOmQDAGIVuNYAAAAASUVORK5CYII=');
        }
        .message {
            max-width: 80%;
            padding: 8px 12px;
            margin-bottom: 10px;
            border-radius: 8px;
            font-size: 14px;
            line-height: 1.4;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        .message.sent {
            background: #DCF8C6;
            margin-left: auto;
            border-bottom-right-radius: 0;
        }
        .message.received {
            background: white;
            border-bottom-left-radius: 0;
        }
        .message .time {
            font-size: 11px;
            color: #999;
            text-align: right;
            margin-top: 4px;
        }
        .input-area {
            display: flex;
            gap: 10px;
            padding: 10px 15px;
            background: #F0F0F0;
        }
        .input-area input {
            flex: 1;
            padding: 12px 15px;
            border: none;
            border-radius: 25px;
            font-size: 15px;
            outline: none;
        }
        .input-area button {
            width: 45px;
            height: 45px;
            border: none;
            background: #25D366;
            border-radius: 50%;
            cursor: pointer;
            color: white;
            font-size: 20px;
        }
        .input-area button:hover { background: #128C7E; }
        .quick-btns {
            display: flex;
            flex-wrap: wrap;
            gap: 5px;
            padding: 10px 15px;
            background: #F0F0F0;
            border-top: 1px solid #DDD;
        }
        .quick-btns button {
            padding: 6px 12px;
            border: 1px solid #25D366;
            background: white;
            border-radius: 15px;
            cursor: pointer;
            font-size: 12px;
            color: #075E54;
        }
        .quick-btns button:hover { background: #DCF8C6; }
        .reason { font-size: 11px; color: #666; font-style: italic; padding: 0 15px 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="avatar">🚌</div>
            <div>
                <h1>Supra Travels Bot</h1>
                <small>Test Mode - Desktop Simulator</small>
            </div>
        </div>
        <div class="chat" id="chat"></div>
        <div class="reason" id="reason"></div>
        <div class="quick-btns">
            <button onclick="send('Hi')">Hi</button>
            <button onclick="send('1')">1</button>
            <button onclick="send('2')">2</button>
            <button onclick="send('3')">3</button>
            <button onclick="send('4')">4</button>
            <button onclick="send('5')">5</button>
            <button onclick="send('my booking')">My Booking</button>
            <button onclick="send('seats available')">Availability</button>
        </div>
        <div class="input-area">
            <input type="text" id="msg" placeholder="Type a message..." onkeypress="if(event.key==='Enter')send()">
            <button onclick="send()">➤</button>
        </div>
    </div>
    <script>
        const chat = document.getElementById('chat');
        const reason = document.getElementById('reason');
        const msgInput = document.getElementById('msg');
        
        function addMessage(text, type) {
            const div = document.createElement('div');
            div.className = 'message ' + type;
            div.innerHTML = text + '<div class="time">' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) + '</div>';
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
        }
        
        async function send(text) {
            const msg = text || msgInput.value.trim();
            if (!msg) return;
            
            msgInput.value = '';
            addMessage(msg, 'sent');
            
            try {
                const res = await fetch('/api/test-reply', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: msg })
                });
                const data = await res.json();
                
                if (data.reply) {
                    addMessage(data.reply, 'received');
                }
                reason.textContent = '↳ ' + (data.reason || 'No response');
            } catch (err) {
                addMessage('❌ Error: ' + err.message, 'received');
            }
        }
        
        // Welcome message
        addMessage('🙏 Welcome! Type a message or use quick buttons below.', 'received');
    </script>
</body>
</html>
    `);
});

module.exports = router;
