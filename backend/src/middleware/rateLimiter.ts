import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

/**
 * Rate limiter configurations for different endpoint types
 */
export const rateLimitConfigs = {
  // General API endpoints
  api: {
    windowMs: env.RATE_LIMIT_WINDOW_MS, // 15 minutes by default
    max: env.RATE_LIMIT_MAX_REQUESTS, // 100 requests per window by default
    message: {
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: env.RATE_LIMIT_WINDOW_MS / 1000 / 60 // minutes
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Authentication endpoints (more restrictive)
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: {
      error: 'Too many authentication attempts',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: 15
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful auth requests
  },

  // Webhook endpoints (high volume allowed)
  webhook: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // 1000 webhooks per minute
    message: {
      error: 'Webhook rate limit exceeded',
      message: 'Too many webhook requests. Please reduce the frequency.',
      retryAfter: 1
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req: Request) => {
      // Skip rate limiting for local development
      const clientIp = req.ip || req.connection.remoteAddress;
      return clientIp === '127.0.0.1' || clientIp === '::1';
    }
  },

  // Password reset endpoints (very restrictive)
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 attempts per hour
    message: {
      error: 'Too many password reset attempts',
      message: 'Too many password reset attempts. Please try again later.',
      retryAfter: 60
    },
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Analytics endpoints (moderate)
  analytics: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 requests per 5 minutes
    message: {
      error: 'Analytics rate limit exceeded',
      message: 'Too many analytics requests. Please slow down.',
      retryAfter: 5
    },
    standardHeaders: true,
    legacyHeaders: false,
  }
};

/**
 * Create a rate limiter with user-specific tracking
 */
const createUserBasedRateLimit = (config: any): RateLimitRequestHandler => {
  return rateLimit({
    ...config,
    keyGenerator: (req: AuthRequest) => {
      // Use user ID if authenticated, otherwise fall back to IP
      const userId = req.user?.userId;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      return userId ? `user:${userId}` : `ip:${clientIp}`;
    },
    handler: (req: Request, res: Response) => {
      const userId = (req as AuthRequest).user?.userId;
      const clientIp = req.ip || req.connection.remoteAddress;
      
      logger.warn(`Rate limit exceeded`, {
        userId,
        clientIp,
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        error: config.message.error,
        message: config.message.message,
        retryAfter: config.message.retryAfter,
        timestamp: new Date().toISOString()
      });
    }
  });
};

/**
 * Create IP-based rate limiter (for unauthenticated endpoints)
 */
const createIpBasedRateLimit = (config: any): RateLimitRequestHandler => {
  return rateLimit({
    ...config,
    keyGenerator: (req: Request) => {
      return req.ip || req.connection.remoteAddress || 'unknown';
    },
    handler: (req: Request, res: Response) => {
      const clientIp = req.ip || req.connection.remoteAddress;
      
      logger.warn(`IP rate limit exceeded`, {
        clientIp,
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        error: config.message.error,
        message: config.message.message,
        retryAfter: config.message.retryAfter,
        timestamp: new Date().toISOString()
      });
    }
  });
};

/**
 * Rate limiters for different endpoint types
 */
export const rateLimiters = {
  // General API rate limiter (user-based)
  api: createUserBasedRateLimit(rateLimitConfigs.api),

  // Authentication endpoints (IP-based, more restrictive)
  auth: createIpBasedRateLimit(rateLimitConfigs.auth),

  // Webhook endpoints (IP-based, high volume)
  webhook: createIpBasedRateLimit(rateLimitConfigs.webhook),

  // Password reset (IP-based, very restrictive)
  passwordReset: createIpBasedRateLimit(rateLimitConfigs.passwordReset),

  // Analytics endpoints (user-based, moderate)
  analytics: createUserBasedRateLimit(rateLimitConfigs.analytics),
};

/**
 * Middleware to apply appropriate rate limiting based on endpoint
 */
export const applyRateLimit = (type: keyof typeof rateLimiters): RateLimitRequestHandler => {
  return rateLimiters[type];
};

/**
 * Dynamic rate limiter that can adjust limits based on user tier
 */
export const createDynamicRateLimit = (baseConfig: any) => {
  return rateLimit({
    ...baseConfig,
    keyGenerator: (req: AuthRequest) => {
      const userId = req.user?.userId;
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      return userId ? `user:${userId}` : `ip:${clientIp}`;
    },
    max: (req: AuthRequest) => {
      const userId = req.user?.userId;
      
      // If user is authenticated, we could check their plan/tier
      // For now, use base limit
      // TODO: Implement user tier checking
      // const userTier = await getUserTier(userId);
      // return getUserTierLimit(userTier, baseConfig.max);
      
      return baseConfig.max;
    },
    handler: (req: Request, res: Response) => {
      const userId = (req as AuthRequest).user?.userId;
      const clientIp = req.ip || req.connection.remoteAddress;
      
      logger.warn(`Dynamic rate limit exceeded`, {
        userId,
        clientIp,
        endpoint: req.path,
        method: req.method,
        userAgent: req.get('User-Agent')
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'You have exceeded your rate limit. Consider upgrading your plan for higher limits.',
        retryAfter: baseConfig.windowMs / 1000 / 60,
        timestamp: new Date().toISOString()
      });
    }
  });
};

/**
 * Global rate limiter for all requests (DDoS protection)
 */
export const globalRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute per IP
  message: {
    error: 'Global rate limit exceeded',
    message: 'Too many requests from this IP. Please try again later.',
    retryAfter: 1
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
  handler: (req: Request, res: Response) => {
    const clientIp = req.ip || req.connection.remoteAddress;
    
    logger.warn(`Global rate limit exceeded`, {
      clientIp,
      endpoint: req.path,
      method: req.method,
      userAgent: req.get('User-Agent')
    });

    res.status(429).json({
      error: 'Global rate limit exceeded',
      message: 'Too many requests from this IP. Please try again later.',
      retryAfter: 1,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Rate limiter bypass for trusted IPs (e.g., monitoring services)
 */
export const createTrustedIpRateLimit = (config: any, trustedIps: string[] = []) => {
  return rateLimit({
    ...config,
    skip: (req: Request) => {
      const clientIp = req.ip || req.connection.remoteAddress;
      return trustedIps.includes(clientIp || '');
    }
  });
};

export default {
  rateLimiters,
  applyRateLimit,
  createDynamicRateLimit,
  createUserBasedRateLimit,
  createIpBasedRateLimit,
  createTrustedIpRateLimit,
  globalRateLimit
};