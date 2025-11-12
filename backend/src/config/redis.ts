import Redis, { Redis as RedisClient, RedisOptions } from 'ioredis';
import { env, getRedisConfig, isDevelopment } from './env';

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

    try {
      const redisConfig = getRedisConfig();
      
      const options: RedisOptions = {
        host: redisConfig.host,
        port: redisConfig.port,
        ...(redisConfig.password && { password: redisConfig.password }),
        db: redisConfig.db,
        connectTimeout: 10000,
        lazyConnect: true,
        maxRetriesPerRequest: 3,
        enableAutoPipelining: true,
        keepAlive: 30000,
      };

      this.client = new Redis(options);

      // Event handlers
      this.client.on('connect', () => {
        console.log('✅ Connected to Redis');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('ready', () => {
        console.log('✅ Redis is ready to receive commands');
      });

      this.client.on('error', (error) => {
        console.error('❌ Redis connection error:', error.message);
        this.isConnected = false;
        
        if (isDevelopment()) {
          console.warn('⚠️  Redis unavailable in development mode - using fallback processing');
        }
      });

      this.client.on('close', () => {
        console.log('🔌 Redis connection closed');
        this.isConnected = false;
      });

      this.client.on('reconnecting', (ms: number) => {
        this.reconnectAttempts++;
        console.log(`🔄 Redis reconnecting in ${ms}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.error('❌ Max Redis reconnection attempts reached');
          this.client?.disconnect();
        }
      });

      this.client.on('end', () => {
        console.log('📴 Redis connection ended');
        this.isConnected = false;
      });

      // Attempt to connect
      await this.client.connect();
      
      return this.client;
    } catch (error) {
      console.error('❌ Failed to connect to Redis:', error);
      
      if (isDevelopment()) {
        console.warn('⚠️  Continuing without Redis in development mode');
        return null;
      } else {
        throw error;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        console.log('✅ Redis disconnected gracefully');
      } catch (error) {
        console.error('❌ Error disconnecting from Redis:', error);
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
      console.error('❌ Redis ping failed:', error);
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
      console.error('❌ Redis health check failed:', error);
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
  console.log('📴 SIGTERM received, closing Redis connection...');
  await disconnectRedis();
});

process.on('SIGINT', async () => {
  console.log('📴 SIGINT received, closing Redis connection...');
  await disconnectRedis();
});

export default redisConnection;