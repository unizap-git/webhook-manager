import { Redis } from 'ioredis';
import { Worker, Queue } from 'bullmq';
import { env, getRedisConfig } from '../config/env';
import { logger } from '../utils/logger';

// Redis connection (optional in development)
let redis: Redis | null = null;
let webhookQueue: Queue | null = null;

// Only initialize Redis if not in development or if explicitly enabled
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_REDIS === 'true') {
  try {
    const redisConfig = getRedisConfig();

    // Skip Redis initialization if host is localhost (not configured)
    if (redisConfig.host === 'localhost' || redisConfig.host === '127.0.0.1') {
      logger.warn('⚠️ Redis not configured - using fallback mode without queue');
    } else {
      redis = new Redis({
        ...redisConfig,
        password: redisConfig.password ?? '',
        maxRetriesPerRequest: 0,
        enableOfflineQueue: false,
        retryStrategy: () => null, // Never retry
      });

      // Create queue if Redis is available
      webhookQueue = new Queue('webhook-processing', {
        connection: redis,
      });
    }
  } catch (error) {
    logger.warn('Redis connection failed, running without queue:', error);
  }
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