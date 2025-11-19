import * as cron from 'node-cron';
import { env, isDevelopment } from '../config/env';
import { AnalyticsService } from './analyticsService';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface CronJobConfig {
  name: string;
  schedule: string;
  task: () => Promise<void>;
  enabled?: boolean;
  runOnStart?: boolean;
}

export class CronService {
  private static instance: CronService;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private prisma: PrismaClient;
  private analyticsService: AnalyticsService;
  private isStarted: boolean = false;

  private constructor() {
    this.prisma = new PrismaClient();
    this.analyticsService = new AnalyticsService();
  }

  public static getInstance(): CronService {
    if (!CronService.instance) {
      CronService.instance = new CronService();
    }
    return CronService.instance;
  }

  public async start(): Promise<void> {
    if (this.isStarted) {
      logger.info('⏰ Cron service already running');
      return;
    }

    try {
      logger.info('🚀 Starting cron service...');
      
      // Define all cron jobs
      const jobConfigs: CronJobConfig[] = [
        {
          name: 'analytics-aggregation',
          schedule: env.ANALYTICS_AGGREGATION_INTERVAL,
          task: this.aggregateAnalytics.bind(this),
          enabled: true,
          runOnStart: isDevelopment() // Run immediately in development
        },
        {
          name: 'cleanup-old-data',
          schedule: '0 2 * * *', // Daily at 2 AM
          task: this.cleanupOldData.bind(this),
          enabled: true
        },
        {
          name: 'refresh-analytics-cache',
          schedule: '*/30 * * * *', // Every 30 minutes
          task: this.refreshAnalyticsCache.bind(this),
          enabled: true
        },
        {
          name: 'health-check',
          schedule: '*/5 * * * *', // Every 5 minutes
          task: this.performHealthCheck.bind(this),
          enabled: isDevelopment() // Only in development
        }
      ];

      // Schedule all jobs
      for (const config of jobConfigs) {
        await this.scheduleJob(config);
      }

      this.isStarted = true;
      logger.info('✅ Cron service started');

    } catch (error) {
      logger.error('❌ Failed to start cron service:', error);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    try {
      logger.info('⏹️ Stopping cron service...');

      // Destroy all scheduled tasks
      for (const [name, task] of this.jobs) {
        task.destroy();
        // Job stopped silently
      }

      this.jobs.clear();
      this.isStarted = false;

      logger.info('✅ Cron service stopped');
    } catch (error) {
      logger.error('❌ Error stopping cron service:', error);
      throw error;
    }
  }

  private async scheduleJob(config: CronJobConfig): Promise<void> {
    const { name, schedule, task, enabled = true, runOnStart = false } = config;

    if (!enabled) {
      // Skip disabled jobs silently
      return;
    }

    try {
      // Validate cron schedule
      if (!cron.validate(schedule)) {
        throw new Error(`Invalid cron schedule: ${schedule}`);
      }

      // Create the scheduled task
      const scheduledTask = cron.schedule(schedule, async () => {
        const startTime = Date.now();
        // Job running

        try {
          await task();
          const duration = Date.now() - startTime;
          // Job completed
        } catch (error) {
          logger.error(`❌ Cron job failed: ${name}`, error);
        }
      }, {
        timezone: 'UTC'
      });

      this.jobs.set(name, scheduledTask);
      logger.info(`📅 Scheduled: ${name} (${schedule})`);

      // Run immediately if requested
      if (runOnStart) {
        // Run startup job silently
        await task();
      }

    } catch (error) {
      logger.error(`❌ Failed to schedule job ${name}:`, error);
      throw error;
    }
  }

  // Analytics aggregation job
  private async aggregateAnalytics(): Promise<void> {
    try {
      // Starting analytics aggregation
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      // Get all users for aggregation
      const users = await this.prisma.user.findMany({
        select: { id: true }
      });

      for (const user of users) {
        try {
          await this.analyticsService.aggregateUserAnalytics(user.id, oneHourAgo, now);
        } catch (error) {
          logger.error(`Failed to aggregate analytics for user ${user.id}:`, error);
        }
      }

      // Analytics aggregation completed
    } catch (error) {
      logger.error('❌ Analytics aggregation failed:', error);
      throw error;
    }
  }

  // Cleanup old data job
  private async cleanupOldData(): Promise<void> {
    try {
      // Starting data cleanup

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - env.ANALYTICS_CLEANUP_DAYS);

      // Clean old analytics cache entries
      const deletedAnalytics = await this.prisma.analyticsCache.deleteMany({
        where: {
          date: {
            lt: cutoffDate
          }
        }
      });

      // Clean old message events (keep recent ones for debugging)
      const deletedEvents = await this.prisma.messageEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`🧹 Cleanup: ${deletedAnalytics.count} analytics, ${deletedEvents.count} events removed`);
    } catch (error) {
      logger.error('❌ Data cleanup failed:', error);
      throw error;
    }
  }

  // Refresh analytics cache job
  private async refreshAnalyticsCache(): Promise<void> {
    try {
      // Refreshing analytics cache

      const users = await this.prisma.user.findMany({
        select: { id: true }
      });

      for (const user of users) {
        try {
          // Refresh current hour analytics
          const now = new Date();
          const hourStart = new Date(now);
          hourStart.setMinutes(0, 0, 0);

          await this.analyticsService.getAnalytics(user.id, {
            startDate: hourStart,
            endDate: now,
            forceRefresh: true
          });
        } catch (error) {
          logger.error(`Failed to refresh cache for user ${user.id}:`, error);
        }
      }

      // Cache refresh completed
    } catch (error) {
      logger.error('❌ Cache refresh failed:', error);
      throw error;
    }
  }

  // Health check job
  private async performHealthCheck(): Promise<void> {
    try {
      // Check database connectivity
      await this.prisma.$queryRaw`SELECT 1`;
      
      // Check for any stuck jobs or unusual patterns
      const recentMessages = await this.prisma.message.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        }
      });

      const recentEvents = await this.prisma.messageEvent.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        }
      });

      if (isDevelopment()) {
        // Health check passed
      }
    } catch (error) {
      logger.error('❌ Health check failed:', error);
      throw error;
    }
  }

  // Utility methods
  public getJobStatus(jobName: string): boolean {
    const job = this.jobs.get(jobName);
    return job ? job.getStatus() === 'scheduled' : false;
  }

  public listJobs(): string[] {
    return Array.from(this.jobs.keys());
  }

  public async runJobNow(jobName: string): Promise<void> {
    const job = this.jobs.get(jobName);
    if (!job) {
      throw new Error(`Job not found: ${jobName}`);
    }

    // Manually triggering job
    // We need to manually call the task function since cron doesn't expose it
    // This is a simplified version - in production you might want to store task references
    switch (jobName) {
      case 'analytics-aggregation':
        await this.aggregateAnalytics();
        break;
      case 'cleanup-old-data':
        await this.cleanupOldData();
        break;
      case 'refresh-analytics-cache':
        await this.refreshAnalyticsCache();
        break;
      case 'health-check':
        await this.performHealthCheck();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  public isRunning(): boolean {
    return this.isStarted;
  }
}

// Singleton instance
const cronService = CronService.getInstance();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('📴 SIGTERM received, stopping cron service...');
  await cronService.stop();
});

process.on('SIGINT', async () => {
  logger.info('📴 SIGINT received, stopping cron service...');
  await cronService.stop();
});

export default cronService;