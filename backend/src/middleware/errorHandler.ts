import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

export const errorHandler = (
  error: ErrorWithStatus,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = error.status || error.statusCode || 500;
  const message = error.message || 'Internal Server Error';

  logger.error(`Error ${statusCode}: ${message}`, {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    stack: error.stack,
  });

  // Don't leak error details in production
  const responseMessage = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal Server Error'
    : message;

  res.status(statusCode).json({
    error: {
      message: responseMessage,
      status: statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};