import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError, PrismaClientValidationError } from '@prisma/client/runtime/library';
import { JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';
import { isDevelopment } from '../config/env';

export interface AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errorCode?: string;
  details?: any;
}

export class CustomError extends Error implements AppError {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode?: string;
  public details?: any;

  constructor(
    message: string, 
    statusCode: number = 500, 
    isOperational: boolean = true,
    errorCode?: string,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (errorCode) this.errorCode = errorCode;
    if (details) this.details = details;

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Specific error classes
export class ValidationError extends CustomError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends CustomError {
  constructor(message: string = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends CustomError {
  constructor(message: string = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends CustomError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, true, 'NOT_FOUND_ERROR');
  }
}

export class ConflictError extends CustomError {
  constructor(message: string) {
    super(message, 409, true, 'CONFLICT_ERROR');
  }
}

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Error response formatter
 */
interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  errorCode?: string;
  details?: any;
  stack?: string;
  timestamp: string;
  path: string;
  method: string;
}

const formatErrorResponse = (
  error: AppError | Error,
  req: Request,
  includeStack: boolean = false
): ErrorResponse => {
  const isAppError = error instanceof CustomError;
  
  const response: ErrorResponse = {
    error: error.name || 'Error',
    message: error.message || 'An error occurred',
    statusCode: isAppError ? error.statusCode : 500,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  if (isAppError) {
    if (error.errorCode) response.errorCode = error.errorCode;
    if (error.details) response.details = error.details;
  }

  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  return response;
};

/**
 * Handle Prisma errors
 */
const handlePrismaError = (error: any): AppError => {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = error.meta?.target as string[] || [];
        return new ConflictError(
          `Duplicate entry for ${target.join(', ')}. This record already exists.`
        );
      
      case 'P2025':
        // Record not found
        return new NotFoundError('Record');
      
      default:
        return new CustomError(
          'Database operation failed',
          500,
          true,
          'DATABASE_ERROR',
          { code: error.code, meta: error.meta }
        );
    }
  }
  
  if (error instanceof PrismaClientUnknownRequestError) {
    return new CustomError(
      'Database connection failed',
      503,
      true,
      'DATABASE_CONNECTION_ERROR'
    );
  }

  return new CustomError('Database error occurred', 500, true, 'DATABASE_UNKNOWN_ERROR');
};

/**
 * Handle JWT errors
 */
const handleJWTError = (error: any): AppError => {
  if (error instanceof TokenExpiredError) {
    return new AuthenticationError('Token has expired');
  }
  
  if (error instanceof JsonWebTokenError) {
    return new AuthenticationError('Invalid token');
  }
  
  if (error instanceof NotBeforeError) {
    return new AuthenticationError('Token not active yet');
  }

  return new AuthenticationError('Authentication failed');
};

/**
 * Handle different error types
 */
const handleError = (error: any): AppError => {
  // Already a custom app error
  if (error instanceof CustomError) {
    return error;
  }

  // Prisma errors
  if (error instanceof PrismaClientKnownRequestError || 
      error instanceof PrismaClientUnknownRequestError || 
      error instanceof PrismaClientValidationError) {
    return handlePrismaError(error);
  }

  // JWT errors
  if (error instanceof JsonWebTokenError || 
      error instanceof TokenExpiredError || 
      error instanceof NotBeforeError) {
    return handleJWTError(error);
  }

  // Default unknown error
  return new CustomError(
    'An unexpected error occurred',
    500,
    false,
    'UNKNOWN_ERROR'
  );
};

/**
 * Log error with appropriate level
 */
const logError = (error: AppError | Error, req: Request): void => {
  const logData = {
    error: error.name,
    message: error.message,
    statusCode: (error as AppError).statusCode || 500,
    path: req.path,
    method: req.method,
    userId: (req as any).user?.userId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    stack: error.stack
  };

  const isAppError = error instanceof CustomError;
  const statusCode = isAppError ? error.statusCode : 500;

  if (statusCode >= 500) {
    logger.error('Server error occurred', logData);
  } else if (statusCode >= 400) {
    logger.warn('Client error occurred', logData);
  } else {
    logger.info('Error handled', logData);
  }
};

export const errorHandler = (
  error: ErrorWithStatus | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Handle the error and convert to AppError
  const appError = handleError(error);
  
  // Log the error
  logError(appError, req);

  // Don't send error details in production unless it's operational
  const includeStack = isDevelopment() || (appError.isOperational && appError.statusCode < 500);
  
  // Format and send error response
  const errorResponse = formatErrorResponse(appError, req, includeStack);
  
  res.status(appError.statusCode).json(errorResponse);
};

/**
 * Handle async route errors
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 404 handler for undefined routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path}`);
  next(error);
};