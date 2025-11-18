import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    accountType: string;
    parentId?: string;
  };
  effectiveUserId?: string;
}

// Helper function to calculate date range based on period
const calculateDateRange = (period: string) => {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999); // End of today
  const startDate = new Date();
  
  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0); // Start of today
      break;
    case 'yesterday':
      startDate.setDate(endDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0); // Start of yesterday
      endDate.setDate(endDate.getDate() - 1);
      endDate.setHours(23, 59, 59, 999); // End of yesterday
      break;
    case '1d':
      startDate.setDate(endDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      startDate.setHours(0, 0, 0, 0);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
  }
  
  return { startDate, endDate };
};

export const getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.effectiveUserId;
    const { period = '7d', vendorId, channelId } = req.query;

    // Calculate date range using helper function
    const { startDate, endDate } = calculateDateRange(period as string);

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

export const getAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.effectiveUserId;
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
    const userId = req.effectiveUserId;
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

export const getDebugEventData = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.effectiveUserId;
    const { limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Get recent message events with raw payload data
    const messageEvents = await prisma.messageEvent.findMany({
      where: {
        message: {
          userId: userId,
        },
        rawPayload: {
          not: null,
        },
      },
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: parseInt(limit as string),
    });

    // Parse and analyze the data
    const debugData = messageEvents.map(event => {
      let parsedPayload = {};
      let parseError = null;
      
      try {
        parsedPayload = event.rawPayload ? JSON.parse(event.rawPayload) : {};
      } catch (error) {
        parseError = (error as Error).message;
      }

      return {
        eventId: event.id,
        messageId: event.messageId,
        timestamp: event.timestamp,
        
        // Current database status
        dbStatus: event.status,
        dbReason: event.reason,
        
        // Raw payload analysis
        rawEventName: (parsedPayload as any).eventName,
        rawStatus: (parsedPayload as any).status,
        rawDeliveryStatus: (parsedPayload as any).deliveryStatus,
        
        // Message details
        vendor: event.message.vendor.name,
        channel: event.message.channel.type,
        recipient: event.message.recipient,
        
        // Raw payload (for debugging)
        fullRawPayload: parsedPayload,
        parseError,
        
        // Analysis
        mapping: {
          eventName: (parsedPayload as any).eventName,
          shouldBeStatus: mapEventNameToStatus((parsedPayload as any).eventName),
          actualStatus: event.status,
          isCorrect: mapEventNameToStatus((parsedPayload as any).eventName) === event.status,
        }
      };
    });

    // Summary statistics
    const summary = {
      totalEvents: debugData.length,
      mappingIssues: debugData.filter(d => !d.mapping.isCorrect).length,
      eventNameDistribution: {},
      statusDistribution: {},
      vendorChannelBreakdown: {},
    };

    // Event name distribution
    debugData.forEach(d => {
      const eventName = d.rawEventName || 'unknown';
      (summary.eventNameDistribution as any)[eventName] = 
        ((summary.eventNameDistribution as any)[eventName] || 0) + 1;
      
      const status = d.dbStatus;
      (summary.statusDistribution as any)[status] = 
        ((summary.statusDistribution as any)[status] || 0) + 1;
        
      const vendorChannel = `${d.vendor}_${d.channel}`;
      if (!(summary.vendorChannelBreakdown as any)[vendorChannel]) {
        (summary.vendorChannelBreakdown as any)[vendorChannel] = {
          eventNames: {},
          statuses: {},
        };
      }
      
      const vcBreakdown = (summary.vendorChannelBreakdown as any)[vendorChannel];
      vcBreakdown.eventNames[eventName] = (vcBreakdown.eventNames[eventName] || 0) + 1;
      vcBreakdown.statuses[status] = (vcBreakdown.statuses[status] || 0) + 1;
    });

    res.json({
      summary,
      debugData,
      mappingIssues: debugData.filter(d => !d.mapping.isCorrect),
    });
  } catch (error) {
    logger.error('Debug event data error:', error);
    next(error);
  }
};

// Enhanced Vendor-Channel Analytics
export const getVendorChannelAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.effectiveUserId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { period = '7d', startDate, endDate } = req.query;

    // Calculate date range using helper function or custom dates
    let startDate_calc: Date, endDate_calc: Date;
    
    if (startDate && endDate) {
      startDate_calc = new Date(startDate as string);
      endDate_calc = new Date(endDate as string);
    } else {
      const dateRange = calculateDateRange(period as string);
      startDate_calc = dateRange.startDate;
      endDate_calc = dateRange.endDate;
    }

    // Get all message events with their raw payloads
    const messageEvents = await prisma.messageEvent.findMany({
      where: {
        message: {
          userId: userId,
          createdAt: {
            gte: startDate_calc,
            lte: endDate_calc,
          },
        },
      },
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Process vendor-channel analytics
    const vendorChannelStats: { [key: string]: any } = {};

    messageEvents.forEach(event => {
      const vendor = event.message.vendor.name;
      const channel = event.message.channel.type;
      const key = `${vendor}_${channel}`;

      if (!vendorChannelStats[key]) {
        vendorChannelStats[key] = {
          vendor,
          channel,
          totalMessages: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          events: {},
          failureReasons: {},
          deliveryRate: 0,
          readRate: 0,
          failureRate: 0,
        };
      }

      const stats = vendorChannelStats[key];
      stats.totalMessages += 1;

      // Parse raw payload for detailed analytics
      let eventName = event.status;
      let failureReason = event.reason;

      try {
        if (event.rawPayload) {
          const payload = JSON.parse(event.rawPayload);
          eventName = payload.eventName || event.status;
          failureReason = payload.reason || payload.error || payload.failureReason || event.reason;
        }
      } catch (error) {
        logger.error('Error parsing raw payload:', error);
      }

      // Count by event status
      if (event.status === 'sent') stats.sent += 1;
      else if (event.status === 'delivered') stats.delivered += 1;
      else if (event.status === 'read') stats.read += 1;
      else if (event.status === 'failed') stats.failed += 1;

      // Count by event name from raw payload
      stats.events[eventName] = (stats.events[eventName] || 0) + 1;

      // Track failure reasons
      if (event.status === 'failed' && failureReason) {
        stats.failureReasons[failureReason] = (stats.failureReasons[failureReason] || 0) + 1;
      }
    });

    // Calculate rates for each vendor-channel combination
    Object.values(vendorChannelStats).forEach((stats: any) => {
      if (stats.totalMessages > 0) {
        stats.deliveryRate = Math.round(((stats.delivered + stats.read) / stats.totalMessages) * 10000) / 100;
        stats.readRate = Math.round((stats.read / stats.totalMessages) * 10000) / 100;
        stats.failureRate = Math.round((stats.failed / stats.totalMessages) * 10000) / 100;
        stats.successRate = Math.round(((stats.delivered + stats.read + stats.sent) / stats.totalMessages) * 10000) / 100;
      }

      // Sort failure reasons by count
      stats.failureReasons = Object.entries(stats.failureReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a: any, b: any) => b.count - a.count);

      // Sort events by count
      stats.events = Object.entries(stats.events)
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((a: any, b: any) => b.count - a.count);
    });

    // Convert to array and sort by total messages
    const vendorChannelArray = Object.values(vendorChannelStats)
      .sort((a: any, b: any) => b.totalMessages - a.totalMessages);

    res.json({
      vendorChannelStats: vendorChannelArray,
      period,
      dateRange: {
        startDate: startDate_calc,
        endDate: endDate_calc,
      },
      summary: {
        totalVendorChannelCombinations: vendorChannelArray.length,
        totalMessages: vendorChannelArray.reduce((sum: number, vc: any) => sum + vc.totalMessages, 0),
      },
    });
  } catch (error) {
    logger.error('Vendor-channel analytics error:', error);
    next(error);
  }
};

// Channel-wise Analytics
export const getChannelAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.effectiveUserId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { period = '7d', startDate, endDate } = req.query;

    // Calculate date range using helper function or custom dates
    let startDate_calc: Date, endDate_calc: Date;
    
    if (startDate && endDate) {
      startDate_calc = new Date(startDate as string);
      endDate_calc = new Date(endDate as string);
    } else {
      const dateRange = calculateDateRange(period as string);
      startDate_calc = dateRange.startDate;
      endDate_calc = dateRange.endDate;
    }

    // Get all message events grouped by channel
    const messageEvents = await prisma.messageEvent.findMany({
      where: {
        message: {
          userId: userId,
          createdAt: {
            gte: startDate_calc,
            lte: endDate_calc,
          },
        },
      },
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
    });

    // Process channel analytics
    const channelStats: { [key: string]: any } = {};

    messageEvents.forEach(event => {
      const channel = event.message.channel.type;

      if (!channelStats[channel]) {
        channelStats[channel] = {
          channel,
          totalMessages: 0,
          sent: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          vendors: {},
          events: {},
          failureReasons: {},
          deliveryRate: 0,
          readRate: 0,
          failureRate: 0,
          dailyStats: {},
        };
      }

      const stats = channelStats[channel];
      stats.totalMessages += 1;

      // Count by status
      if (event.status === 'sent') stats.sent += 1;
      else if (event.status === 'delivered') stats.delivered += 1;
      else if (event.status === 'read') stats.read += 1;
      else if (event.status === 'failed') stats.failed += 1;

      // Track vendors for this channel
      const vendor = event.message.vendor.name;
      if (!stats.vendors[vendor]) {
        stats.vendors[vendor] = { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 };
      }
      
      if (event.status === 'sent') stats.vendors[vendor].sent += 1;
      else if (event.status === 'delivered') stats.vendors[vendor].delivered += 1;
      else if (event.status === 'read') stats.vendors[vendor].read += 1;
      else if (event.status === 'failed') stats.vendors[vendor].failed += 1;
      stats.vendors[vendor].total += 1;

      // Parse raw payload for detailed analytics
      let eventName = event.status;
      let failureReason = event.reason;

      try {
        if (event.rawPayload) {
          const payload = JSON.parse(event.rawPayload);
          eventName = payload.eventName || event.status;
          failureReason = payload.reason || payload.error || payload.failureReason || event.reason;
        }
      } catch (error) {
        logger.error('Error parsing raw payload:', error);
      }

      // Count by event name
      stats.events[eventName] = (stats.events[eventName] || 0) + 1;

      // Track failure reasons
      if (event.status === 'failed' && failureReason) {
        stats.failureReasons[failureReason] = (stats.failureReasons[failureReason] || 0) + 1;
      }

      // Daily breakdown
      const dateKey = event.timestamp.toISOString().split('T')[0];
      if (!stats.dailyStats[dateKey]) {
        stats.dailyStats[dateKey] = { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 };
      }
      
      if (event.status === 'sent') stats.dailyStats[dateKey].sent += 1;
      else if (event.status === 'delivered') stats.dailyStats[dateKey].delivered += 1;
      else if (event.status === 'read') stats.dailyStats[dateKey].read += 1;
      else if (event.status === 'failed') stats.dailyStats[dateKey].failed += 1;
      stats.dailyStats[dateKey].total += 1;
    });

    // Calculate rates and format data
    Object.values(channelStats).forEach((stats: any) => {
      if (stats.totalMessages > 0) {
        stats.deliveryRate = Math.round(((stats.delivered + stats.read) / stats.totalMessages) * 10000) / 100;
        stats.readRate = Math.round((stats.read / stats.totalMessages) * 10000) / 100;
        stats.failureRate = Math.round((stats.failed / stats.totalMessages) * 10000) / 100;
        stats.successRate = Math.round(((stats.delivered + stats.read + stats.sent) / stats.totalMessages) * 10000) / 100;
      }

      // Format vendor stats
      stats.vendors = Object.entries(stats.vendors)
        .map(([vendor, counts]: [string, any]) => ({
          vendor,
          ...counts,
          successRate: counts.total > 0 ? Math.round(((counts.delivered + counts.read) / counts.total) * 10000) / 100 : 0,
        }))
        .sort((a: any, b: any) => b.total - a.total);

      // Sort failure reasons
      stats.failureReasons = Object.entries(stats.failureReasons)
        .map(([reason, count]) => ({ reason, count }))
        .sort((a: any, b: any) => b.count - a.count);

      // Sort events
      stats.events = Object.entries(stats.events)
        .map(([eventName, count]) => ({ eventName, count }))
        .sort((a: any, b: any) => b.count - a.count);

      // Format daily stats
      stats.dailyStats = Object.entries(stats.dailyStats)
        .map(([date, counts]: [string, any]) => ({
          date,
          ...counts,
          successRate: counts.total > 0 ? Math.round(((counts.delivered + counts.read) / counts.total) * 10000) / 100 : 0,
        }))
        .sort((a: any, b: any) => a.date.localeCompare(b.date));
    });

    const channelArray = Object.values(channelStats)
      .sort((a: any, b: any) => b.totalMessages - a.totalMessages);

    res.json({
      channelStats: channelArray,
      period,
      dateRange: {
        startDate: startDate_calc,
        endDate: endDate_calc,
      },
      summary: {
        totalChannels: channelArray.length,
        totalMessages: channelArray.reduce((sum: number, ch: any) => sum + ch.totalMessages, 0),
      },
    });
  } catch (error) {
    logger.error('Channel analytics error:', error);
    next(error);
  }
};

// Failure Reason Analytics
export const getFailureAnalytics = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.effectiveUserId;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { period = '7d', startDate, endDate, vendorId, channelId } = req.query;

    // Calculate date range using helper function or custom dates
    let startDate_calc: Date, endDate_calc: Date;
    
    if (startDate && endDate) {
      startDate_calc = new Date(startDate as string);
      endDate_calc = new Date(endDate as string);
    } else {
      const dateRange = calculateDateRange(period as string);
      startDate_calc = dateRange.startDate;
      endDate_calc = dateRange.endDate;
    }

    // Build where clause
    const whereClause: any = {
      message: {
        userId: userId,
        createdAt: {
          gte: startDate_calc,
          lte: endDate_calc,
        },
      },
      status: 'failed',
    };

    if (vendorId) {
      whereClause.message.vendorId = vendorId as string;
    }

    if (channelId) {
      whereClause.message.channelId = channelId as string;
    }

    // Get all failed message events
    const failedEvents = await prisma.messageEvent.findMany({
      where: whereClause,
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Process failure analytics
    const failureStats: { [key: string]: any } = {};
    const vendorChannelFailures: { [key: string]: { [reason: string]: number } } = {};
    const dailyFailures: { [key: string]: { [reason: string]: number } } = {};

    failedEvents.forEach(event => {
      let failureReason = event.reason || 'Unknown';

      // Extract failure reason from raw payload
      try {
        if (event.rawPayload) {
          const payload = JSON.parse(event.rawPayload);
          failureReason = payload.reason || payload.error || payload.failureReason || 
                         payload.errorMessage || payload.description || event.reason || 'Unknown';
          
          // Handle common error patterns
          if (payload.status && payload.status.toLowerCase().includes('fail')) {
            failureReason = payload.status;
          }
          if (payload.deliveryStatus && payload.deliveryStatus.toLowerCase().includes('fail')) {
            failureReason = payload.deliveryStatus;
          }
        }
      } catch (error) {
        logger.error('Error parsing failure payload:', error);
      }

      const vendor = event.message.vendor.name;
      const channel = event.message.channel.type;
      const vendorChannelKey = `${vendor}_${channel}`;
      const dateKey = event.timestamp.toISOString().split('T')[0];

      // Overall failure reason stats
      if (!failureStats[failureReason]) {
        failureStats[failureReason] = {
          reason: failureReason,
          count: 0,
          vendors: {},
          channels: {},
          examples: [],
        };
      }

      failureStats[failureReason].count += 1;
      failureStats[failureReason].vendors[vendor] = (failureStats[failureReason].vendors[vendor] || 0) + 1;
      failureStats[failureReason].channels[channel] = (failureStats[failureReason].channels[channel] || 0) + 1;

      // Store example for debugging (limit to 3 examples per reason)
      if (failureStats[failureReason].examples.length < 3) {
        failureStats[failureReason].examples.push({
          messageId: event.messageId,
          recipient: event.message.recipient,
          timestamp: event.timestamp,
          rawPayload: event.rawPayload ? JSON.parse(event.rawPayload) : null,
        });
      }

      // Vendor-channel failures
      if (!vendorChannelFailures[vendorChannelKey]) {
        vendorChannelFailures[vendorChannelKey] = {};
      }
      vendorChannelFailures[vendorChannelKey][failureReason] = 
        (vendorChannelFailures[vendorChannelKey][failureReason] || 0) + 1;

      // Daily failures
      if (!dailyFailures[dateKey]) {
        dailyFailures[dateKey] = {};
      }
      dailyFailures[dateKey][failureReason] = (dailyFailures[dateKey][failureReason] || 0) + 1;
    });

    // Format failure stats
    const failureArray = Object.values(failureStats)
      .map((stats: any) => ({
        ...stats,
        percentage: Math.round((stats.count / failedEvents.length) * 10000) / 100,
        vendors: Object.entries(stats.vendors).map(([vendor, count]) => ({ vendor, count })),
        channels: Object.entries(stats.channels).map(([channel, count]) => ({ channel, count })),
      }))
      .sort((a: any, b: any) => b.count - a.count);

    // Format vendor-channel failures
    const vendorChannelArray = Object.entries(vendorChannelFailures)
      .map(([vendorChannel, reasons]) => {
        const [vendor, channel] = vendorChannel.split('_');
        const totalFailures = Object.values(reasons).reduce((sum: number, count: any) => sum + count, 0);
        
        return {
          vendor,
          channel,
          totalFailures,
          reasons: Object.entries(reasons)
            .map(([reason, count]) => ({
              reason,
              count,
              percentage: Math.round((count as number / totalFailures) * 10000) / 100,
            }))
            .sort((a, b) => b.count - a.count),
        };
      })
      .sort((a, b) => b.totalFailures - a.totalFailures);

    // Format daily failures
    const dailyArray = Object.entries(dailyFailures)
      .map(([date, reasons]) => ({
        date,
        totalFailures: Object.values(reasons).reduce((sum: number, count: any) => sum + count, 0),
        reasons: Object.entries(reasons)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      summary: {
        totalFailedMessages: failedEvents.length,
        uniqueFailureReasons: failureArray.length,
        topFailureReason: failureArray[0]?.reason || null,
        period,
      },
      failureReasons: failureArray,
      vendorChannelFailures: vendorChannelArray,
      dailyFailures: dailyArray,
      dateRange: {
        startDate: startDate_calc,
        endDate: endDate_calc,
      },
    });
  } catch (error) {
    logger.error('Failure analytics error:', error);
    next(error);
  }
};

// Helper function to map event names to status
function mapEventNameToStatus(eventName: string): string {
  if (!eventName) return 'sent';
  
  const eventMap: { [key: string]: string } = {
    'delivered': 'delivered',
    'sent': 'sent',
    'failed': 'failed',
    'rejected': 'failed',
    'undelivered': 'failed',
    'expired': 'failed',
    'unknown': 'failed',
    'read': 'read',
    'pending': 'sent',
    'queued': 'sent',
    'error': 'failed',
  };
  
  return eventMap[eventName.toLowerCase()] || 'sent';
}