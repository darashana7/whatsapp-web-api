const express = require('express');
const config = require('../config');
const logger = require('./utils/logger');
const whatsappClient = require('./whatsapp/client');
const { setupMessageHandlers } = require('./whatsapp/handlers');
const routes = require('./api/routes');
const { apiKeyAuth, requestLogger, errorHandler } = require('./api/middleware');

const app = express();

// Middleware
app.use(express.json());
app.use(requestLogger);
app.use(apiKeyAuth);

// API Routes
app.use('/api', routes);

// Root redirect to status
app.get('/', (req, res) => {
    res.redirect('/api/status');
});

// Error handler
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal) {
    logger.info(`Received ${signal}. Shutting down gracefully...`);

    try {
        await whatsappClient.destroy();
    } catch (error) {
        logger.error('Error during shutdown:', error);
    }

    process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start server
async function start() {
    try {
        // Start Express server first (for health checks)
        const server = app.listen(config.port, '0.0.0.0', () => {
            logger.info(`🚀 Server running on port ${config.port}`);
            logger.info(`📡 Health check: http://localhost:${config.port}/api/health`);
            logger.info(`📱 QR Code page: http://localhost:${config.port}/api/qr?format=html`);
        });

        // Initialize WhatsApp client
        logger.info('Starting WhatsApp client initialization...');
        const client = await whatsappClient.initialize();

        // Setup message handlers for auto-reply
        setupMessageHandlers(client);

        logger.info('✅ WhatsApp API is fully initialized');
        logger.info(`Auto-reply is ${config.autoReply.enabled ? 'ENABLED' : 'DISABLED'}`);

    } catch (error) {
        logger.error('Failed to start application:', error);
        process.exit(1);
    }
}

start();
