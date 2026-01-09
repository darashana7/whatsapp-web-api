const config = require('../../config');
const logger = require('../utils/logger');

/**
 * API Key authentication middleware
 */
function apiKeyAuth(req, res, next) {
    // Skip auth if no API key is configured
    if (!config.apiKey) {
        return next();
    }

    // Allow health check without auth
    if (req.path === '/health' || req.path === '/api/health') {
        return next();
    }

    // Check for API key in header or query
    const providedKey = req.headers['x-api-key'] ||
        req.headers['authorization']?.replace('Bearer ', '') ||
        req.query.api_key;

    if (!providedKey) {
        logger.warn(`Unauthorized request to ${req.path} - No API key provided`);
        return res.status(401).json({
            success: false,
            error: 'API key required'
        });
    }

    if (providedKey !== config.apiKey) {
        logger.warn(`Unauthorized request to ${req.path} - Invalid API key`);
        return res.status(403).json({
            success: false,
            error: 'Invalid API key'
        });
    }

    next();
}

/**
 * Request logging middleware
 */
function requestLogger(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logLevel = res.statusCode >= 400 ? 'warn' : 'info';

        logger[logLevel](`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });

    next();
}

/**
 * Error handling middleware
 */
function errorHandler(err, req, res, next) {
    logger.error('Unhandled error:', err);

    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}

module.exports = {
    apiKeyAuth,
    requestLogger,
    errorHandler
};
