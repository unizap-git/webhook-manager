import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, url } = req;
    const { statusCode } = res;
    
    // Only log errors, health checks, and webhook events
    if (statusCode >= 400 || url.includes('/webhook') || url === '/health') {
      const status = statusCode >= 500 ? '❌' : statusCode >= 400 ? '⚠️' : '✅';
      logger.info(`${status} ${method} ${url} ${statusCode} (${duration}ms)`);
    }
  });
  
  next();
};