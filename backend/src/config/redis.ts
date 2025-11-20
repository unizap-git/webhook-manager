import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { env, getRedisConfig, isDevelopment } from './env';
import { logger } from '../utils/logger';

export class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClient | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  private constructor() {}

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  public async connect(): Promise<RedisClient | null> {
    if (this.isConnected && this.client) {
      return this.client;
    }

    // Check if Redis URL is configured and not localhost
    const redisConfig = getRedisConfig();
    if (redisConfig.host === 'localhost' || redisConfig.host === '127.0.0.1') {
      logger.warn('⚠️ Redis not configured - using fallback mode');
      return null;
    }

    try {
      const options: RedisOptions = {
        host: redisConfig.host,
        port: redisConfig.port,
        ...(redisConfig.password && { password: redisConfig.password }),
        db: redisConfig.db,
        connectTimeout: 5000,
        lazyConnect: true,
        maxRetriesPerRequest: 0,
        enableAutoPipelining: true,
        enableOfflineQueue: false,
        retryStrategy: () => null, // Never retry
      };

      this.client = new Redis(options);

      // Event handlers
      this.client.on('connect', () => {
        logger.info('✅ Redis connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis ready');
      });

      this.client.on('error', (error) => {
        logger.error('❌ Redis connection error:');
        logger.warn('⚠️ Redis unavailable - using fallback');
        this.isConnected = false;
        // Immediately disconnect to prevent reconnection attempts
        if (this.client) {
          this.client.disconnect(false);
        }
      });

      this.client.on('close', () => {
        // Redis connection closed
        this.isConnected = false;
        if (this.client) {
          this.client.disconnect();
        }
      });

      this.client.on('end', () => {
        // Redis connection ended
        this.isConnected = false;
      });

      // Attempt to connect
      await this.client.connect();
      
      return this.client;
    } catch (error) {
      logger.error('❌ Failed to connect to Redis:', error);
      logger.warn('⚠️ Continuing without Redis - queue processing will use fallback mode');
      return null;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        // Redis disconnected gracefully
      } catch (error) {
        logger.error('❌ Error disconnecting from Redis:', error);
        this.client.disconnect();
      } finally {
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
      }
    }
  }

  public getClient(): RedisClient | null {
    return this.client;
  }

  public isRedisConnected(): boolean {
    return this.isConnected && this.client !== null;
  }

  public async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      const response = await this.client.ping();
      return response === 'PONG';
    } catch (error) {
      logger.error('❌ Redis ping failed:', error);
      return false;
    }
  }

  public async healthCheck(): Promise<{
    connected: boolean;
    latency?: number;
    memory?: any;
    info?: any;
  }> {
    if (!this.client || !this.isConnected) {
      return { connected: false };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      const [memoryStats, info] = await Promise.all([
        this.client.memory('STATS'),
        this.client.info('memory')
      ]);

      return {
        connected: true,
        latency,
        memory: memoryStats,
        info
      };
    } catch (error) {
      logger.error('❌ Redis health check failed:', error);
      return { connected: false };
    }
  }
}

// Singleton instance
const redisConnection = RedisConnection.getInstance();

// Helper functions for easy access
export const getRedisClient = async (): Promise<RedisClient | null> => {
  return await redisConnection.connect();
};

export const disconnectRedis = async (): Promise<void> => {
  await redisConnection.disconnect();
};

export const isRedisAvailable = (): boolean => {
  return redisConnection.isRedisConnected();
};

export const pingRedis = async (): Promise<boolean> => {
  return await redisConnection.ping();
};

export const getRedisHealthStatus = async () => {
  return await redisConnection.healthCheck();
};

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('📴 SIGTERM: closing Redis connection...');
  await disconnectRedis();
});

process.on('SIGINT', async () => {
  logger.info('📴 SIGINT: closing Redis connection...');
  await disconnectRedis();
});

export default redisConnection;