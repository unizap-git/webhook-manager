import { Redis as RedisClient } from 'ioredis';
import RedisConnection from '../config/redis';
import { logger } from '../utils/logger';

export interface CacheMetadata {
  cached: boolean;
  cachedAt?: string;
  expiresIn?: number; // seconds remaining until expiration
}

export class CacheService {
  private static instance: CacheService;
  private redisConnection: typeof RedisConnection;

  private constructor() {
    this.redisConnection = RedisConnection;
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Generate a cache key for analytics endpoints
   */
  public generateCacheKey(
    endpoint: string,
    userId: string,
    projectId: string | null | undefined,
    period: string
  ): string {
    const project = projectId === 'all' || !projectId ? 'all' : projectId;
    return `analytics:${endpoint}:${userId}:${project}:${period}`;
  }

  /**
   * Get cached data
   */
  public async get<T = any>(key: string): Promise<{ data: T | null; metadata: CacheMetadata }> {
    try {
      const client = this.redisConnection.getClient();

      if (!client || !this.redisConnection.isRedisConnected()) {
        return {
          data: null,
          metadata: { cached: false },
        };
      }

      const cachedData = await client.get(key);

      if (!cachedData) {
        return {
          data: null,
          metadata: { cached: false },
        };
      }

      // Get TTL (time to live) for the key
      const ttl = await client.ttl(key);

      const parsedData = JSON.parse(cachedData);

      const metadata: CacheMetadata = {
        cached: true,
        cachedAt: parsedData.cachedAt,
      };

      // Add expiresIn only if TTL is positive
      if (ttl > 0) {
        metadata.expiresIn = ttl;
      }

      return {
        data: parsedData.data,
        metadata,
      };
    } catch (error) {
      logger.error('L Cache get error:', error);
      return {
        data: null,
        metadata: { cached: false },
      };
    }
  }

  /**
   * Set cached data with TTL
   */
  public async set(key: string, data: any, ttlSeconds: number): Promise<boolean> {
    try {
      const client = this.redisConnection.getClient();

      if (!client || !this.redisConnection.isRedisConnected()) {
        logger.warn('�  Redis not available - skipping cache set');
        return false;
      }

      const cacheData = {
        data,
        cachedAt: new Date().toISOString(),
      };

      await client.setex(key, ttlSeconds, JSON.stringify(cacheData));

      logger.debug(` Cache set: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      logger.error('L Cache set error:', error);
      return false;
    }
  }

  /**
   * Delete cached data
   */
  public async delete(key: string): Promise<boolean> {
    try {
      const client = this.redisConnection.getClient();

      if (!client || !this.redisConnection.isRedisConnected()) {
        return false;
      }

      await client.del(key);

      logger.debug(`=�  Cache deleted: ${key}`);
      return true;
    } catch (error) {
      logger.error('L Cache delete error:', error);
      return false;
    }
  }

  /**
   * Delete all cached data matching a pattern
   */
  public async deletePattern(pattern: string): Promise<number> {
    try {
      const client = this.redisConnection.getClient();

      if (!client || !this.redisConnection.isRedisConnected()) {
        return 0;
      }

      const keys = await client.keys(pattern);

      if (keys.length === 0) {
        return 0;
      }

      await client.del(...keys);

      logger.debug(`=�  Cache deleted ${keys.length} keys matching: ${pattern}`);
      return keys.length;
    } catch (error) {
      logger.error('L Cache delete pattern error:', error);
      return 0;
    }
  }

  /**
   * Check if Redis is available
   */
  public isAvailable(): boolean {
    return this.redisConnection.isRedisConnected();
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();
