import { Request, Response, NextFunction } from 'express';
import { cacheService } from '../services/cacheService';
import { logger } from '../utils/logger';

export interface AuthRequest extends Request {
  userId?: string;
  effectiveUserId?: string;
}

/**
 * Middleware factory for analytics caching
 * @param endpoint - Analytics endpoint name (dashboard, vendor-channel, channels, failures)
 * @param ttlSeconds - Cache TTL in seconds
 */
export const analyticsCacheMiddleware = (endpoint: string, ttlSeconds: number) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.effectiveUserId || req.userId;
      const { period = '7d', projectId, vendorId, channelId, nocache } = req.query;

      // Skip cache if:
      // 1. nocache query parameter is present (Refresh button)
      // 2. Redis is not available
      // 3. No userId (authentication issue)
      if (nocache === 'true' || !cacheService.isAvailable() || !userId) {
        if (nocache === 'true') {
          logger.debug(`= Cache bypass requested for ${endpoint}`);
        }
        return next();
      }

      // Generate cache key with all filter parameters
      const cacheKey = cacheService.generateCacheKey(
        endpoint,
        userId,
        projectId as string,
        period as string,
        vendorId as string,
        channelId as string
      );

      // Try to get cached data
      const { data: cachedData, metadata } = await cacheService.get(cacheKey);

      if (cachedData && metadata.cached) {
        logger.debug(` Cache hit: ${cacheKey} (expires in ${metadata.expiresIn}s)`);

        // Return cached data with metadata
        return res.json({
          ...cachedData,
          meta: metadata,
        });
      }

      logger.debug(`L Cache miss: ${cacheKey}`);

      // Store original res.json function
      const originalJson = res.json.bind(res);

      // Override res.json to cache the response
      res.json = function (body: any) {
        // Cache the response (without meta field)
        const dataToCache = { ...body };
        delete dataToCache.meta;

        // Cache asynchronously (don't wait for it)
        cacheService.set(cacheKey, dataToCache, ttlSeconds).catch((error) => {
          logger.error('Failed to cache response:', error);
        });

        // Add cache metadata to response
        const responseWithMeta = {
          ...body,
          meta: {
            cached: false,
            cachedAt: new Date().toISOString(),
            expiresIn: ttlSeconds,
          },
        };

        // Call original res.json
        return originalJson(responseWithMeta);
      };

      // Continue to controller
      next();
    } catch (error) {
      logger.error('Analytics cache middleware error:', error);
      // On error, just proceed without caching
      next();
    }
  };
};

/**
 * Tiered TTL configuration for different endpoints
 */
export const CACHE_TTL = {
  projects: 30 * 60, // 30 minutes (rarely changes)
  dashboard: 15 * 60, // 15 minutes (increased from 10)
  vendorChannel: 15 * 60, // 15 minutes
  channels: 15 * 60, // 15 minutes
  failures: 10 * 60, // 10 minutes (decreased from 20 for debugging freshness)
};

/**
 * Pre-configured middleware for each analytics endpoint
 */
export const projectsCache = analyticsCacheMiddleware('projects', CACHE_TTL.projects);
export const dashboardCache = analyticsCacheMiddleware('dashboard', CACHE_TTL.dashboard);
export const vendorChannelCache = analyticsCacheMiddleware('vendor-channel', CACHE_TTL.vendorChannel);
export const channelsCache = analyticsCacheMiddleware('channels', CACHE_TTL.channels);
export const failuresCache = analyticsCacheMiddleware('failures', CACHE_TTL.failures);
