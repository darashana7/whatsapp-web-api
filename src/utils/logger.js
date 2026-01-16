const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ level, message, timestamp, stack }) => {
            if (stack) {
                return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
            }
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf((info) => {
                    const { level, message, timestamp, stack, ...meta } = info;
                    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
                    if (stack) {
                        return `${timestamp} [${level}]: ${message}${metaStr}\n${stack}`;
                    }
                    return `${timestamp} [${level}]: ${message}${metaStr}`;
                })
            )
        })
    ]
});

module.exports = logger;
