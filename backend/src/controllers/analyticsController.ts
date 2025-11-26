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
    const { period = '7d', vendorId, channelId, projectId } = req.query;

    // Calculate date range using helper function
    const { startDate, endDate } = calculateDateRange(period as string);

    // Get actual message counts from messageEvent table for accuracy
    const messageWhereClause: any = {
      message: {
        userId,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
    };

    if (vendorId) {
      messageWhereClause.message.vendorId = vendorId as string;
    }

    if (channelId) {
      messageWhereClause.message.channelId = channelId as string;
    }

    if (projectId && projectId !== 'all') {
      messageWhereClause.message.projectId = projectId as string;
    }

    // Get all message events with timestamp to determine latest status
    const messageEvents = await prisma.messageEvent.findMany({
      where: messageWhereClause,
      select: {
        messageId: true,
        status: true,
        timestamp: true,
        message: {
          select: {
            createdAt: true,
            vendorId: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    // Group events by messageId and get the LATEST event for each message
    const latestEventByMessage = new Map<string, { status: string; timestamp: Date; createdAt: Date; vendorId: string }>();

    messageEvents.forEach(event => {
      const existing = latestEventByMessage.get(event.messageId);
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        latestEventByMessage.set(event.messageId, {
          status: event.status,
          timestamp: event.timestamp,
          createdAt: event.message.createdAt,
          vendorId: event.message.vendorId,
        });
      }
    });

    // Count unique messages by their FINAL status only
    const statusCounts = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    latestEventByMessage.forEach(({ status }) => {
      if (status === 'sent') statusCounts.sent += 1;
      else if (status === 'delivered') statusCounts.delivered += 1;
      else if (status === 'read') statusCounts.read += 1;
      else if (status === 'failed') statusCounts.failed += 1;
    });

    const totalSent = statusCounts.sent;
    const totalDelivered = statusCounts.delivered;
    const totalRead = statusCounts.read;
    const totalFailed = statusCounts.failed;
    const totalMessages = latestEventByMessage.size;

    // Calculate rates
    const deliveryRate = totalMessages > 0 ? (totalDelivered + totalRead) / totalMessages * 100 : 0;
    const readRate = totalMessages > 0 ? totalRead / totalMessages * 100 : 0;
    const failureRate = totalMessages > 0 ? totalFailed / totalMessages * 100 : 0;

    // Group unique messages by date for daily stats (using final status only)
    const dailyStatsMap = new Map();

    latestEventByMessage.forEach((eventData, messageId) => {
      // Extract date from message.createdAt
      const dateKey = new Date(eventData.createdAt).toISOString().split('T')[0];

      if (!dailyStatsMap.has(dateKey)) {
        // Create a normalized date at UTC midnight for consistency
        const normalizedDate = new Date(dateKey + 'T00:00:00.000Z');
        dailyStatsMap.set(dateKey, {
          date: normalizedDate,
          dateKey: dateKey,
          totalSent: 0,
          totalDelivered: 0,
          totalRead: 0,
          totalFailed: 0,
        });
      }

      const dailyStat = dailyStatsMap.get(dateKey);

      // Count by final status only (one count per message)
      if (eventData.status === 'sent') dailyStat.totalSent += 1;
      else if (eventData.status === 'delivered') dailyStat.totalDelivered += 1;
      else if (eventData.status === 'read') dailyStat.totalRead += 1;
      else if (eventData.status === 'failed') dailyStat.totalFailed += 1;
    });

    // Group unique messages by vendor (using final status only)
    const vendorStatsMap = new Map();

    latestEventByMessage.forEach((eventData, messageId) => {
      if (!vendorStatsMap.has(eventData.vendorId)) {
        vendorStatsMap.set(eventData.vendorId, {
          vendorId: eventData.vendorId,
          totalSent: 0,
          totalDelivered: 0,
          totalRead: 0,
          totalFailed: 0,
        });
      }

      const vendorStat = vendorStatsMap.get(eventData.vendorId);

      // Count by final status only (one count per message)
      if (eventData.status === 'sent') vendorStat.totalSent += 1;
      else if (eventData.status === 'delivered') vendorStat.totalDelivered += 1;
      else if (eventData.status === 'read') vendorStat.totalRead += 1;
      else if (eventData.status === 'failed') vendorStat.totalFailed += 1;
    });

    // Get vendor names
    const vendorIds = Array.from(vendorStatsMap.keys()).filter(Boolean);
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
    });

    const vendorStatsWithNames = Array.from(vendorStatsMap.values()).map((stat: any) => {
      const vendor = vendors.find(v => v.id === stat.vendorId);
      const total = stat.totalSent + stat.totalDelivered + stat.totalRead + stat.totalFailed;
      const successRate = total > 0 ?
        ((stat.totalDelivered + stat.totalRead) / total * 100) : 0;

      return {
        vendorId: stat.vendorId,
        vendorName: vendor?.name || 'Unknown',
        totalMessages: total,
        successRate: Math.round(successRate * 100) / 100,
        totalSent: stat.totalSent,
        totalDelivered: stat.totalDelivered,
        totalRead: stat.totalRead,
        totalFailed: stat.totalFailed,
      };
    });

    // Format daily stats with success rates
    const formattedDailyStats = Array.from(dailyStatsMap.values()).map((stat: any) => {
      const totalMessages = stat.totalSent + stat.totalDelivered + stat.totalRead + stat.totalFailed;
      const successRate = totalMessages > 0 ?
        ((stat.totalDelivered + stat.totalRead) / totalMessages * 100) : 0;

      return {
        date: stat.date,
        totalMessages,
        successRate,
        totalSent: stat.totalSent,
        totalDelivered: stat.totalDelivered,
        totalRead: stat.totalRead,
        totalFailed: stat.totalFailed,
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
      dailyStats: formattedDailyStats,
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
      projectId,
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

    if (projectId && projectId !== 'all') {
      whereClause.projectId = projectId as string;
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
    const { period = '7d', vendorId, channelId, projectId } = req.query;

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

    if (projectId && projectId !== 'all') {
      whereClause.message.projectId = projectId as string;
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

export const getDebugEventData = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.effectiveUserId;
    const { limit = 50 } = req.query;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
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
export const getVendorChannelAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.effectiveUserId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { period = '7d', startDate, endDate, projectId, limit = '50000' } = req.query;
    const maxEvents = Math.min(parseInt(limit as string) || 50000, 100000); // Cap at 100k events

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

    // Build where clause for message events
    const messageWhereClause: any = {
      userId: userId,
      createdAt: {
        gte: startDate_calc,
        lte: endDate_calc,
      },
    };

    if (projectId && projectId !== 'all') {
      messageWhereClause.projectId = projectId as string;
    }

    // Optimized query: select only needed fields, add limit
    const messageEvents = await prisma.messageEvent.findMany({
      where: {
        message: messageWhereClause,
      },
      select: {
        messageId: true,
        status: true,
        reason: true,
        timestamp: true,
        rawPayload: true,
        message: {
          select: {
            vendor: { select: { name: true } },
            channel: { select: { type: true } },
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: maxEvents,
    });

    // First, get the latest event for each unique message
    const latestEventByMessageVC = new Map<string, any>();

    messageEvents.forEach(event => {
      const existing = latestEventByMessageVC.get(event.messageId);
      if (!existing || new Date(event.timestamp) > new Date(existing.timestamp)) {
        latestEventByMessageVC.set(event.messageId, event);
      }
    });

    // Process vendor-channel analytics using ONLY the latest event per message
    const vendorChannelStats: { [key: string]: any } = {};
    const uniqueMessagesVC: { [key: string]: Set<string> } = {}; // Track unique message IDs per vendor-channel

    latestEventByMessageVC.forEach(event => {
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
        uniqueMessagesVC[key] = new Set();
      }

      const stats = vendorChannelStats[key];

      // Count unique messages only
      if (uniqueMessagesVC[key]) {
        uniqueMessagesVC[key].add(event.messageId);
      }

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

      // Count by FINAL event status only (one count per message)
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
    Object.entries(vendorChannelStats).forEach(([key, stats]: [string, any]) => {
      // Set the actual unique message count
      stats.totalMessages = uniqueMessagesVC[key]?.size || 0;

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

    const totalEventsProcessed = messageEvents.length;
    const isLimitReached = totalEventsProcessed >= maxEvents;

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
        eventsProcessed: totalEventsProcessed,
        limitReached: isLimitReached,
      },
    });
  } catch (error) {
    logger.error('Vendor-channel analytics error:', error);
    next(error);
  }
};

// Channel-wise Analytics
export const getChannelAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.effectiveUserId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { period = '7d', startDate, endDate, projectId, limit = '50000' } = req.query;
    const maxEvents = Math.min(parseInt(limit as string) || 50000, 100000); // Cap at 100k events

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

    // Build where clause for message events
    const messageWhereClause: any = {
      userId: userId,
      createdAt: {
        gte: startDate_calc,
        lte: endDate_calc,
      },
    };

    if (projectId && projectId !== 'all') {
      messageWhereClause.projectId = projectId as string;
    }

    // Optimized query: select only needed fields, add limit
    const messageEvents = await prisma.messageEvent.findMany({
      where: {
        message: messageWhereClause,
      },
      select: {
        messageId: true,
        status: true,
        reason: true,
        timestamp: true,
        rawPayload: true,
        message: {
          select: {
            vendor: { select: { name: true } },
            channel: { select: { type: true } },
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
      take: maxEvents,
    });

    // Process channel analytics
    const channelStats: { [key: string]: any } = {};
    const uniqueMessagesByChannel: { [key: string]: Set<string> } = {}; // Track unique message IDs per channel

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
        uniqueMessagesByChannel[channel] = new Set();
      }

      const stats = channelStats[channel];

      // Count unique messages only
      if (uniqueMessagesByChannel[channel]) {
        uniqueMessagesByChannel[channel].add(event.messageId);
      }

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
      const dateKey: string = event.timestamp?.toISOString()?.split('T')[0] || '';
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
    Object.entries(channelStats).forEach(([channel, stats]: [string, any]) => {
      // Set the actual unique message count
      stats.totalMessages = uniqueMessagesByChannel[channel]?.size || 0;

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

    const totalEventsProcessed = messageEvents.length;
    const isLimitReached = totalEventsProcessed >= maxEvents;

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
        eventsProcessed: totalEventsProcessed,
        limitReached: isLimitReached,
      },
    });
  } catch (error) {
    logger.error('Channel analytics error:', error);
    next(error);
  }
};

// Failure Reason Analytics
export const getFailureAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.effectiveUserId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { period = '7d', startDate, endDate, vendorId, channelId, projectId } = req.query;

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

    if (projectId && projectId !== 'all') {
      whereClause.message.projectId = projectId as string;
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
      const dateKey: string = event.timestamp?.toISOString()?.split('T')[0] || '';

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

// Get project-wise analytics summary
export const getProjectAnalytics = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.effectiveUserId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { period = '7d' } = req.query;
    const { startDate, endDate } = calculateDateRange(period as string);

    // Get all user's projects
    const projects = await prisma.project.findMany({
      where: {
        OR: [
          { userId: userId }, // User owns the project
          { 
            projectAccess: {
              some: {
                userId: userId,
              },
            },
          }, // User has access to the project
        ],
      },
      include: {
        _count: {
          select: {
            messages: {
              where: {
                createdAt: {
                  gte: startDate,
                  lte: endDate,
                },
              },
            },
            userVendorChannels: true,
          },
        },
      },
    });

    // Get analytics for each project
    const projectAnalytics = await Promise.all(
      projects.map(async (project) => {
        // Get analytics cache for this project
        const stats = await prisma.analyticsCache.aggregate({
          where: {
            userId,
            projectId: project.id,
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
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

        return {
          projectId: project.id,
          projectName: project.name,
          description: project.description,
          vendorCount: project._count?.userVendorChannels || 0,
          channelCount: project._count?.userVendorChannels || 0,
          messageCount: project._count?.messages || 0,
          totalMessages,
          totalSent,
          totalDelivered,
          totalRead,
          totalFailed,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          readRate: Math.round(readRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100,
        };
      })
    );

    // Calculate overall totals
    const overallStats = projectAnalytics.reduce(
      (acc, project) => ({
        totalProjects: acc.totalProjects + 1,
        totalMessages: acc.totalMessages + project.totalMessages,
        totalSent: acc.totalSent + project.totalSent,
        totalDelivered: acc.totalDelivered + project.totalDelivered,
        totalRead: acc.totalRead + project.totalRead,
        totalFailed: acc.totalFailed + project.totalFailed,
      }),
      { totalProjects: 0, totalMessages: 0, totalSent: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0 }
    );

    // Calculate overall rates
    const overallDeliveryRate = overallStats.totalMessages > 0 ? 
      (overallStats.totalDelivered + overallStats.totalRead) / overallStats.totalMessages * 100 : 0;
    const overallReadRate = overallStats.totalMessages > 0 ? 
      overallStats.totalRead / overallStats.totalMessages * 100 : 0;
    const overallFailureRate = overallStats.totalMessages > 0 ? 
      overallStats.totalFailed / overallStats.totalMessages * 100 : 0;

    res.json({
      projectAnalytics: projectAnalytics.sort((a, b) => b.totalMessages - a.totalMessages),
      overallStats: {
        ...overallStats,
        deliveryRate: Math.round(overallDeliveryRate * 100) / 100,
        readRate: Math.round(overallReadRate * 100) / 100,
        failureRate: Math.round(overallFailureRate * 100) / 100,
      },
      period,
      dateRange: {
        startDate,
        endDate,
      },
    });
  } catch (error) {
    logger.error('Project analytics error:', error);
    next(error);
  }
};