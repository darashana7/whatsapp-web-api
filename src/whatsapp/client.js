const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const qrcodeLib = require('qrcode');
const config = require('../../config');
const logger = require('../utils/logger');

class WhatsAppClient {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.qrCode = null;
        this.connectionInfo = null;
    }

    async initialize() {
        logger.info('Initializing WhatsApp client...');

        // Puppeteer arguments for Railway/Docker environment
        const puppeteerArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ];

        const clientOptions = {
            authStrategy: new LocalAuth({
                dataPath: './.wwebjs_auth'
            }),
            puppeteer: {
                headless: true,
                args: puppeteerArgs
            }
        };

        // Use custom Chrome path if provided (for Railway/Docker)
        if (config.puppeteerExecutablePath) {
            clientOptions.puppeteer.executablePath = config.puppeteerExecutablePath;
        }

        this.client = new Client(clientOptions);

        // Setup event handlers
        this.setupEventHandlers();

        // Initialize client
        await this.client.initialize();

        return this.client;
    }

    setupEventHandlers() {
        // QR Code event
        this.client.on('qr', async (qr) => {
            logger.info('QR Code received. Scan with WhatsApp mobile app:');

            // Display in terminal
            // qrcode.generate(qr, { small: true });

            // Store for API access
            this.qrCode = qr;
            this.isReady = false;
        });

        // Ready event
        this.client.on('ready', async () => {
            logger.info('✅ WhatsApp client is ready!');
            this.isReady = true;
            this.qrCode = null;

            try {
                const info = this.client.info;
                this.connectionInfo = {
                    name: info.pushname,
                    phone: info.wid.user,
                    platform: info.platform
                };
                logger.info(`Connected as: ${info.pushname} (${info.wid.user})`);
            } catch (error) {
                logger.error('Error getting connection info:', error);
            }
        });

        // Authentication success
        this.client.on('authenticated', () => {
            logger.info('✅ WhatsApp authenticated successfully!');
        });

        // Authentication failure
        this.client.on('auth_failure', (msg) => {
            logger.error('❌ Authentication failed:', msg);
            this.isReady = false;
        });

        // Disconnection
        this.client.on('disconnected', (reason) => {
            logger.warn('⚠️ WhatsApp disconnected:', reason);
            this.isReady = false;
            this.connectionInfo = null;
        });

        // Loading screen
        this.client.on('loading_screen', (percent, message) => {
            logger.info(`Loading: ${percent}% - ${message}`);
        });
    }

    getClient() {
        return this.client;
    }

    getStatus() {
        return {
            isReady: this.isReady,
            hasQrCode: !!this.qrCode,
            connection: this.connectionInfo
        };
    }

    async getQrCodeDataUrl() {
        if (!this.qrCode) return null;
        try {
            return await qrcodeLib.toDataURL(this.qrCode);
        } catch (error) {
            logger.error('Error generating QR code data URL:', error);
            return null;
        }
    }

    async sendMessage(phone, message) {
        if (!this.isReady) {
            throw new Error('WhatsApp client is not ready');
        }

        const { toWhatsAppId } = require('../utils/phone');
        const chatId = toWhatsAppId(phone);

        if (!chatId) {
            throw new Error('Invalid phone number');
        }

        try {
            const result = await this.client.sendMessage(chatId, message);
            logger.info(`Message sent to ${phone}`);
            return {
                success: true,
                messageId: result.id._serialized,
                timestamp: result.timestamp
            };
        } catch (error) {
            logger.error(`Failed to send message to ${phone}:`, error);
            throw error;
        }
    }

    async destroy() {
        if (this.client) {
            await this.client.destroy();
            logger.info('WhatsApp client destroyed');
        }
    }
}

// Singleton instance
const whatsappClient = new WhatsAppClient();

module.exports = whatsappClient;
