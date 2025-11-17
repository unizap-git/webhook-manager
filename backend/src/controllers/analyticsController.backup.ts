import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { period = '7d', vendorId, channelId } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Build where clause
    const whereClause: any = {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (vendorId) {
      whereClause.vendorId = vendorId as string;
    }

    if (channelId) {
      whereClause.channelId = channelId as string;
    }

    // Get aggregated stats
    const stats = await prisma.analyticsCache.aggregate({
      where: whereClause,
      _sum: {
        totalSent: true,
        totalDelivered: true,
        totalRead: true,
        totalFailed: true,
      },
    });

    const totalSent = stats._sum.totalSent || 0;
    const totalDelivered = stats._sum.totalDelivered || 0;
    const totalRead = stats._sum.totalRead || 0;
    const totalFailed = stats._sum.totalFailed || 0;
    const totalMessages = totalSent + totalDelivered + totalRead + totalFailed;

    // Calculate rates
    const deliveryRate = totalMessages > 0 ? (totalDelivered + totalRead) / totalMessages * 100 : 0;
    const readRate = totalMessages > 0 ? totalRead / totalMessages * 100 : 0;
    const failureRate = totalMessages > 0 ? totalFailed / totalMessages * 100 : 0;

    // Get daily breakdown for charts
    const dailyStats = await prisma.analyticsCache.groupBy({
      by: ['date'],
      where: whereClause,
      _sum: {
        totalSent: true,
        totalDelivered: true,
        totalRead: true,
        totalFailed: true,
      },
      orderBy: {
        date: 'asc',
      },
    });

    // Get vendor breakdown
    const vendorStats = await prisma.analyticsCache.groupBy({
      by: ['vendorId'],
      where: whereClause,
      _sum: {
        totalSent: true,
        totalDelivered: true,
        totalRead: true,
        totalFailed: true,
      },
      _count: {
        vendorId: true,
      },
    });

    // Get vendor names
    const vendorIds = vendorStats.map((stat: any) => stat.vendorId).filter(Boolean);
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
    });

    const vendorStatsWithNames = vendorStats.map((stat: any) => {
      const vendor = vendors.find(v => v.id === stat.vendorId);
      const total = (stat._sum.totalSent || 0) + (stat._sum.totalDelivered || 0) + 
                   (stat._sum.totalRead || 0) + (stat._sum.totalFailed || 0);
      const successRate = total > 0 ? 
        ((stat._sum.totalDelivered || 0) + (stat._sum.totalRead || 0)) / total * 100 : 0;
      
      return {
        vendorId: stat.vendorId,
        vendorName: vendor?.name || 'Unknown',
        totalMessages: total,
        successRate: Math.round(successRate * 100) / 100,
        ...stat._sum,
      };
    });

    res.json({
      summary: {
        totalMessages,
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        readRate: Math.round(readRate * 100) / 100,
        failureRate: Math.round(failureRate * 100) / 100,
      },
      dailyStats: dailyStats.map((stat: any) => ({
        date: stat.date,
        totalMessages: (stat._sum.totalSent || 0) + (stat._sum.totalDelivered || 0) + 
                      (stat._sum.totalRead || 0) + (stat._sum.totalFailed || 0),
        successRate: (() => {
          const total = (stat._sum.totalSent || 0) + (stat._sum.totalDelivered || 0) + 
                       (stat._sum.totalRead || 0) + (stat._sum.totalFailed || 0);
          return total > 0 ? 
            ((stat._sum.totalDelivered || 0) + (stat._sum.totalRead || 0)) / total * 100 : 0;
        })(),
        ...stat._sum,
      })),
      vendorStats: vendorStatsWithNames,
      period,
    });
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    next(error);
  }
};

export const getEventAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { period = '7d', vendorId, channelId } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Build where clause for message events
    const whereClause: any = {
      message: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    };

    if (vendorId) {
      whereClause.message.vendorId = vendorId as string;
    }

    if (channelId) {
      whereClause.message.channelId = channelId as string;
    }

    // Get event name breakdown from raw payload
    const messageEvents = await prisma.messageEvent.findMany({
      where: whereClause,
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
    });

    // Parse eventName from rawPayload and group by vendor/channel
    const eventBreakdown: { [key: string]: { [eventName: string]: number } } = {};
    const vendorChannelBreakdown: { [key: string]: { [eventName: string]: number } } = {};
    
    messageEvents.forEach(event => {
      try {
        const payload = event.rawPayload ? JSON.parse(event.rawPayload) : {};
        const eventName = payload.eventName || event.status || 'unknown';
        const vendor = event.message.vendor.name;
        const channel = event.message.channel.type;
        const vendorChannelKey = `${vendor}_${channel}`;

        // Overall event breakdown
        if (!eventBreakdown[eventName]) {
          eventBreakdown[eventName] = { count: 0 };
        }
        eventBreakdown[eventName].count = (eventBreakdown[eventName].count || 0) + 1;

        // Vendor-Channel specific breakdown
        if (!vendorChannelBreakdown[vendorChannelKey]) {
          vendorChannelBreakdown[vendorChannelKey] = {};
        }
        if (!vendorChannelBreakdown[vendorChannelKey][eventName]) {
          vendorChannelBreakdown[vendorChannelKey][eventName] = 0;
        }
        vendorChannelBreakdown[vendorChannelKey][eventName]++;
      } catch (error) {
        logger.error('Error parsing raw payload:', error);
      }
    });

    // Convert to arrays and sort by count
    const eventStats = Object.entries(eventBreakdown)
      .map(([eventName, data]) => ({
        eventName,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);

    const vendorChannelStats = Object.entries(vendorChannelBreakdown)
      .map(([vendorChannel, events]) => {
        const [vendor, channel] = vendorChannel.split('_');
        const totalEvents = Object.values(events).reduce((sum, count) => sum + count, 0);
        
        return {
          vendor,
          channel,
          totalEvents,
          eventBreakdown: Object.entries(events)
            .map(([eventName, count]) => ({
              eventName,
              count,
              percentage: Math.round((count / totalEvents) * 100 * 100) / 100,
            }))
            .sort((a, b) => b.count - a.count),
        };
      })
      .sort((a, b) => b.totalEvents - a.totalEvents);

    res.json({
      eventStats,
      vendorChannelStats,
      period,
      totalEvents: messageEvents.length,
    });
  } catch (error) {
    logger.error('Event analytics error:', error);
    next(error);
  }
};
  try {
    const userId = req.user?.userId;
    const { 
      startDate, 
      endDate, 
      vendorId, 
      channelId, 
      groupBy = 'day',
      limit = 100,
      offset = 0 
    } = req.query;

    // Build where clause for messages
    const whereClause: any = {
      userId,
    };

    if (vendorId) {
      whereClause.vendorId = vendorId as string;
    }

    if (channelId) {
      whereClause.channelId = channelId as string;
    }

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    // Get detailed message analytics
    const messages = await prisma.message.findMany({
      where: whereClause,
      include: {
        vendor: true,
        channel: true,
        events: {
          orderBy: {
            timestamp: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.message.count({
      where: whereClause,
    });

    // Get failure breakdown
    const failureBreakdown = await prisma.messageEvent.groupBy({
      by: ['reason', 'status'],
      where: {
        message: whereClause,
        status: 'failed',
        reason: {
          not: null,
        },
      },
      _count: {
        reason: true,
      },
      orderBy: {
        _count: {
          reason: 'desc',
        },
      },
    });

    res.json({
      messages: messages.map(message => ({
        id: message.id,
        recipient: message.recipient,
        messageId: message.messageId,
        vendor: message.vendor.name,
        channel: message.channel.type,
        status: message.events[0]?.status || 'unknown',
        reason: message.events[0]?.reason || null,
        createdAt: message.createdAt,
        lastEventAt: message.events[0]?.timestamp || null,
      })),
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasNext: parseInt(offset as string) + parseInt(limit as string) < total,
      },
      failureBreakdown: failureBreakdown.map((breakdown: any) => ({
        reason: breakdown.reason,
        count: breakdown._count.reason,
      })),
    });
  } catch (error) {
    logger.error('Analytics error:', error);
    next(error);
  }
};

export const getEventAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { period = '7d', vendorId, channelId } = req.query;

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1d':
        startDate.setDate(endDate.getDate() - 1);
        break;
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      default:
        startDate.setDate(endDate.getDate() - 7);
    }

    // Build where clause for message events
    const whereClause: any = {
      message: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    };

    if (vendorId) {
      whereClause.message.vendorId = vendorId as string;
    }

    if (channelId) {
      whereClause.message.channelId = channelId as string;
    }

    // Get event name breakdown from raw payload
    const messageEvents = await prisma.messageEvent.findMany({
      where: whereClause,
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
    });

    // Parse eventName from rawPayload and group by vendor/channel
    const eventBreakdown: { [key: string]: number } = {};
    const vendorChannelBreakdown: { [key: string]: { [eventName: string]: number } } = {};
    
    messageEvents.forEach(event => {
      try {
        const payload = event.rawPayload ? JSON.parse(event.rawPayload) : {};
        const eventName = payload.eventName || event.status || 'unknown';
        const vendor = event.message.vendor.name;
        const channel = event.message.channel.type;
        const vendorChannelKey = `${vendor}_${channel}`;

        // Overall event breakdown
        eventBreakdown[eventName] = (eventBreakdown[eventName] || 0) + 1;

        // Vendor-Channel specific breakdown
        if (!vendorChannelBreakdown[vendorChannelKey]) {
          vendorChannelBreakdown[vendorChannelKey] = {};
        }
        vendorChannelBreakdown[vendorChannelKey][eventName] = 
          (vendorChannelBreakdown[vendorChannelKey][eventName] || 0) + 1;
      } catch (error) {
        logger.error('Error parsing raw payload:', error);
      }
    });

    // Convert to arrays and sort by count
    const eventStats = Object.entries(eventBreakdown)
      .map(([eventName, count]) => ({
        eventName,
        count,
      }))
      .sort((a, b) => b.count - a.count);

    const vendorChannelStats = Object.entries(vendorChannelBreakdown)
      .map(([vendorChannel, events]) => {
        const [vendor, channel] = vendorChannel.split('_');
        const totalEvents = Object.values(events).reduce((sum, count) => sum + count, 0);
        
        return {
          vendor,
          channel,
          totalEvents,
          eventBreakdown: Object.entries(events)
            .map(([eventName, count]) => ({
              eventName,
              count,
              percentage: Math.round((count / totalEvents) * 100 * 100) / 100,
            }))
            .sort((a, b) => b.count - a.count),
        };
      })
      .sort((a, b) => b.totalEvents - a.totalEvents);

    res.json({
      eventStats,
      vendorChannelStats,
      period,
      totalEvents: messageEvents.length,
    });
  } catch (error) {
    logger.error('Event analytics error:', error);
    next(error);
  }
};