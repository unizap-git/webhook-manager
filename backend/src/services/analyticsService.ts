import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export interface AnalyticsQuery {
  startDate?: Date;
  endDate?: Date;
  vendorId?: string;
  channelId?: string;
  forceRefresh?: boolean;
}

export interface AnalyticsSummary {
  totalMessages: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalFailed: number;
  successRate: number;
}

export class AnalyticsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get analytics for a user with optional filters
   */
  async getAnalytics(userId: string, query: AnalyticsQuery = {}): Promise<AnalyticsSummary> {
    try {
      const {
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default: 7 days ago
        endDate = new Date(),
        vendorId,
        channelId,
        forceRefresh = false
      } = query;

      // Check cache first if not forcing refresh
      if (!forceRefresh) {
        const cachedData = await this.getCachedAnalytics(userId, startDate, endDate, vendorId, channelId);
        if (cachedData) {
          return cachedData;
        }
      }

      // Calculate analytics from raw data
      const analytics = await this.calculateAnalytics(userId, startDate, endDate, vendorId, channelId);

      // Cache the result for future use
      await this.cacheAnalytics(userId, startDate, endDate, analytics, vendorId, channelId);

      return analytics;
    } catch (error) {
      logger.error('Error getting analytics:', error);
      throw new Error('Failed to retrieve analytics');
    }
  }

  /**
   * Aggregate analytics for a specific time period (used by cron jobs)
   */
  async aggregateUserAnalytics(userId: string, startDate: Date, endDate: Date): Promise<void> {
    try {
      logger.info(`Aggregating analytics for user ${userId} from ${startDate} to ${endDate}`);

      // Get all vendor-channel combinations for this user
      const userVendorChannels = await this.prisma.userVendorChannel.findMany({
        where: { userId },
        include: {
          vendor: true,
          channel: true
        }
      });

      // Aggregate for each vendor-channel combination
      for (const uvc of userVendorChannels) {
        await this.aggregateVendorChannelAnalytics(
          userId,
          uvc.vendorId,
          uvc.channelId,
          startDate,
          endDate
        );
      }

      // Also create overall user analytics (across all vendors/channels)
      await this.aggregateVendorChannelAnalytics(
        userId,
        undefined,
        undefined,
        startDate,
        endDate
      );

      logger.info(`Analytics aggregation completed for user ${userId}`);
    } catch (error) {
      logger.error(`Error aggregating analytics for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate analytics from raw message data
   */
  private async calculateAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date,
    vendorId?: string,
    channelId?: string
  ): Promise<AnalyticsSummary> {
    const whereClause: any = {
      userId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    };

    if (vendorId) whereClause.vendorId = vendorId;
    if (channelId) whereClause.channelId = channelId;

    // Get all messages with their latest events
    const messages = await this.prisma.message.findMany({
      where: whereClause,
      include: {
        events: {
          orderBy: { timestamp: 'desc' },
          take: 1
        }
      }
    });

    let totalSent = 0;
    let totalDelivered = 0;
    let totalRead = 0;
    let totalFailed = 0;

    // Classify each message by its latest status
    for (const message of messages) {
      const latestEvent = message.events[0];
      const status = latestEvent?.status || 'sent';

      switch (status) {
        case 'sent':
        case 'queued':
          totalSent++;
          break;
        case 'delivered':
          totalDelivered++;
          break;
        case 'read':
        case 'clicked':
          totalRead++;
          break;
        case 'failed':
        case 'bounced':
        case 'rejected':
        case 'undelivered':
          totalFailed++;
          break;
        default:
          totalSent++; // Default to sent for unknown statuses
      }
    }

    const totalMessages = totalSent + totalDelivered + totalRead + totalFailed;
    const successRate = totalMessages > 0 ? ((totalDelivered + totalRead) / totalMessages) * 100 : 0;

    return {
      totalMessages,
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Aggregate analytics for a specific vendor-channel combination
   */
  private async aggregateVendorChannelAnalytics(
    userId: string,
    vendorId: string | undefined,
    channelId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<void> {
    try {
      const analytics = await this.calculateAnalytics(userId, startDate, endDate, vendorId, channelId);

      // Store in cache with date granularity (daily)
      const date = new Date(startDate);
      date.setHours(0, 0, 0, 0);

      await this.prisma.analyticsCache.upsert({
        where: {
          userId_vendorId_channelId_date: {
            userId,
            vendorId: vendorId || '',
            channelId: channelId || '',
            date
          }
        },
        update: {
          totalSent: analytics.totalSent,
          totalDelivered: analytics.totalDelivered,
          totalRead: analytics.totalRead,
          totalFailed: analytics.totalFailed,
          successRate: analytics.successRate,
          lastUpdated: new Date()
        },
        create: {
          userId,
          vendorId: vendorId || '',
          channelId: channelId || '',
          date,
          totalSent: analytics.totalSent,
          totalDelivered: analytics.totalDelivered,
          totalRead: analytics.totalRead,
          totalFailed: analytics.totalFailed,
          successRate: analytics.successRate
        }
      });
    } catch (error) {
      logger.error('Error aggregating vendor-channel analytics:', error);
      throw error;
    }
  }

  /**
   * Get cached analytics if available
   */
  private async getCachedAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date,
    vendorId?: string,
    channelId?: string
  ): Promise<AnalyticsSummary | null> {
    try {
      const whereClause: any = {
        userId,
        date: {
          gte: startDate,
          lte: endDate
        }
      };

      if (vendorId) whereClause.vendorId = vendorId;
      if (channelId) whereClause.channelId = channelId;

      const cachedData = await this.prisma.analyticsCache.aggregate({
        where: whereClause,
        _sum: {
          totalSent: true,
          totalDelivered: true,
          totalRead: true,
          totalFailed: true
        },
        _avg: {
          successRate: true
        }
      });

      if (!cachedData._sum.totalSent && !cachedData._sum.totalDelivered && 
          !cachedData._sum.totalRead && !cachedData._sum.totalFailed) {
        return null;
      }

      const totalSent = cachedData._sum.totalSent || 0;
      const totalDelivered = cachedData._sum.totalDelivered || 0;
      const totalRead = cachedData._sum.totalRead || 0;
      const totalFailed = cachedData._sum.totalFailed || 0;
      const totalMessages = totalSent + totalDelivered + totalRead + totalFailed;

      return {
        totalMessages,
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        successRate: Math.round((cachedData._avg.successRate || 0) * 100) / 100
      };
    } catch (error) {
      logger.error('Error getting cached analytics:', error);
      return null;
    }
  }

  /**
   * Cache analytics data
   */
  private async cacheAnalytics(
    userId: string,
    startDate: Date,
    endDate: Date,
    analytics: AnalyticsSummary,
    vendorId?: string,
    channelId?: string
  ): Promise<void> {
    try {
      // Cache with daily granularity
      const date = new Date(startDate);
      date.setHours(0, 0, 0, 0);

      await this.prisma.analyticsCache.upsert({
        where: {
          userId_vendorId_channelId_date: {
            userId,
            vendorId: vendorId || '',
            channelId: channelId || '',
            date
          }
        },
        update: {
          totalSent: analytics.totalSent,
          totalDelivered: analytics.totalDelivered,
          totalRead: analytics.totalRead,
          totalFailed: analytics.totalFailed,
          successRate: analytics.successRate,
          lastUpdated: new Date()
        },
        create: {
          userId,
          vendorId: vendorId || '',
          channelId: channelId || '',
          date,
          totalSent: analytics.totalSent,
          totalDelivered: analytics.totalDelivered,
          totalRead: analytics.totalRead,
          totalFailed: analytics.totalFailed,
          successRate: analytics.successRate
        }
      });
    } catch (error) {
      logger.error('Error caching analytics:', error);
      // Don't throw - caching failure shouldn't break the main operation
    }
  }

  /**
   * Get failure reasons breakdown
   */
  async getFailureReasons(userId: string, startDate: Date, endDate: Date): Promise<Array<{reason: string, count: number}>> {
    try {
      const failureBreakdown = await this.prisma.messageEvent.groupBy({
        by: ['reason'],
        where: {
          message: {
            userId,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          status: {
            in: ['failed', 'bounced', 'rejected', 'undelivered']
          },
          reason: {
            not: null
          }
        },
        _count: {
          reason: true
        },
        orderBy: {
          _count: {
            reason: 'desc'
          }
        }
      });

      return failureBreakdown.map((item: any) => ({
        reason: item.reason || 'Unknown',
        count: item._count.reason
      }));
    } catch (error) {
      logger.error('Error getting failure reasons:', error);
      return [];
    }
  }

  /**
   * Clean up old analytics cache entries
   */
  async cleanupOldCache(days: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const result = await this.prisma.analyticsCache.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });

      logger.info(`Cleaned up ${result.count} old analytics cache entries`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up analytics cache:', error);
      throw error;
    }
  }
}