import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Define log formats
const fileFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const consoleFormat = printf(({ level, message, timestamp, stack }) => {
  // Clean console format without service metadata
  return `${timestamp} ${level}: ${stack || message}`;
});

// Create the logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    fileFormat
  ),
  transports: [
    // Write to all logs with level `info` and below to combined.log
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// If we're not in production then also log to the console
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }), // Shorter timestamp for console
      consoleFormat
    )
  }));
}