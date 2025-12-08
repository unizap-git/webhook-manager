import { Redis } from 'ioredis';
import { Worker, Queue } from 'bullmq';
import { env, getRedisConfig } from '../config/env';
import { logger } from '../utils/logger';

// Redis connection (optional)
let redis: Redis | null = null;
let webhookQueue: Queue | null = null;

// Helper to check if Redis is properly configured
function isRedisConfigured(): boolean {
  const redisConfig = getRedisConfig();

  // Check URL-based config
  if ('url' in redisConfig && redisConfig.url) {
    const url = redisConfig.url;
    // Skip if URL points to localhost (not configured for production)
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return false;
    }
    return true;
  }

  // Check host-based config
  if ('host' in redisConfig) {
    const host = (redisConfig as any).host;
    if (host === 'localhost' || host === '127.0.0.1') {
      return false;
    }
    return true;
  }

  return false;
}

// Only initialize Redis if properly configured
if (isRedisConfigured()) {
  try {
    const redisConfig = getRedisConfig();

    if ('url' in redisConfig && redisConfig.url) {
      redis = new Redis(redisConfig.url, {
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        retryStrategy: () => null,
        lazyConnect: true,
      });
    } else {
      redis = new Redis({
        ...(redisConfig as any),
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        retryStrategy: () => null,
        lazyConnect: true,
      });
    }

    // Create queue if Redis is available
    webhookQueue = new Queue('webhook-processing', {
      connection: redis,
    });

    logger.info('✅ Redis queue initialized');
  } catch (error) {
    logger.warn('⚠️ Redis initialization failed, using fallback mode:', error);
    redis = null;
    webhookQueue = null;
  }
} else {
  logger.info('ℹ️ Redis not configured - webhooks will be processed directly');
}

// Export queue (can be null)
export { webhookQueue };

// Initialize workers
export async function initializeWorkers() {
  if (!redis || !webhookQueue) {
    logger.info('Running in development mode without Redis queue processing');
    return;
  }

  try {
    // Test Redis connection
    await redis.ping();
    logger.info('Redis connected successfully');
    
    // Start workers
    startWebhookWorker();
    
    logger.info('All workers initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize workers:', error);
    logger.warn('Running in development mode without Redis queue processing');
  }
}

function startWebhookWorker() {
  if (!redis || !webhookQueue) {
    logger.warn('Cannot start webhook worker: Redis not available');
    return;
  }

  const worker = new Worker(
    'webhook-processing',
    async (job) => {
      const { webhookData, userId, vendor, channel } = job.data;
      
      logger.info(`Processing webhook for user ${userId}, vendor ${vendor}, channel ${channel}`);
      
      try {
        // Import here to avoid circular dependency
        const { processWebhookPayload } = await import('../services/webhookService');
        await processWebhookPayload(webhookData, userId, vendor, channel);
        
        logger.info(`Webhook processed successfully for user ${userId}`);
      } catch (error) {
        logger.error('Webhook processing failed:', error);
        throw error;
      }
    },
    {
      connection: redis,
      concurrency: 5,
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    }
  );

  worker.on('completed', (job) => {
    logger.info(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Job ${job?.id} failed:`, err);
  });

  logger.info('Webhook worker started');
}