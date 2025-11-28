import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Log an outbound message
 * POST /api/outbound
 */
export const logOutboundMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      projectId,
      vendorId,
      channelId,
      vendorRefId,
      recipient,
      content,
      sentAt,
    } = req.body;

    // Validate required fields
    if (!projectId || !vendorId || !channelId || !vendorRefId || !recipient || !content) {
      res.status(400).json({
        error: 'Missing required fields',
        required: ['projectId', 'vendorId', 'channelId', 'vendorRefId', 'recipient', 'content'],
      });
      return;
    }

    // Verify project access
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId }, // Owner
          { projectAccess: { some: { userId } } }, // Has access
        ],
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    // Verify vendor and channel exist
    const [vendor, channel] = await Promise.all([
      prisma.vendor.findUnique({ where: { id: vendorId } }),
      prisma.channel.findUnique({ where: { id: channelId } }),
    ]);

    if (!vendor) {
      res.status(404).json({ error: 'Vendor not found' });
      return;
    }

    if (!channel) {
      res.status(404).json({ error: 'Channel not found' });
      return;
    }

    // Create outbound message record
    const outboundMessage = await prisma.outboundMessage.create({
      data: {
        userId,
        projectId,
        vendorId,
        channelId,
        vendorRefId,
        recipient,
        content,
        sentAt: sentAt ? new Date(sentAt) : new Date(),
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { name: true, slug: true } },
        channel: { select: { name: true, type: true } },
      },
    });

    logger.info(`📤 Outbound logged: ${vendor.name}/${channel.type} | ${vendorRefId}`);

    res.status(201).json({
      success: true,
      message: 'Outbound message logged successfully',
      data: outboundMessage,
    });
  } catch (error) {
    logger.error('Error logging outbound message:', error);
    next(error);
  }
};

/**
 * Batch log multiple outbound messages
 * POST /api/outbound/batch
 */
export const batchLogOutboundMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Messages array is required' });
      return;
    }

    if (messages.length > 100) {
      res.status(400).json({ error: 'Maximum 100 messages per batch' });
      return;
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const msg of messages) {
      try {
        const { projectId, vendorId, channelId, vendorRefId, recipient, content, sentAt } = msg;

        if (!projectId || !vendorId || !channelId || !vendorRefId || !recipient || !content) {
          results.failed++;
          results.errors.push(`Missing required fields for vendorRefId: ${vendorRefId || 'unknown'}`);
          continue;
        }

        await prisma.outboundMessage.create({
          data: {
            userId,
            projectId,
            vendorId,
            channelId,
            vendorRefId,
            recipient,
            content,
            sentAt: sentAt ? new Date(sentAt) : new Date(),
          },
        });

        results.success++;
      } catch (error: any) {
        results.failed++;
        results.errors.push(error.message || 'Unknown error');
      }
    }

    logger.info(`📤 Batch outbound: ${results.success} logged, ${results.failed} failed`);

    res.status(200).json({
      success: true,
      message: 'Batch processing complete',
      results,
    });
  } catch (error) {
    logger.error('Error in batch outbound logging:', error);
    next(error);
  }
};

/**
 * Get outbound messages with optional filters
 * GET /api/outbound
 */
export const getOutboundMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const {
      projectId,
      vendorId,
      channelId,
      startDate,
      endDate,
      page = '1',
      limit = '20',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = { userId };

    if (projectId) where.projectId = projectId;
    if (vendorId) where.vendorId = vendorId;
    if (channelId) where.channelId = channelId;

    if (startDate || endDate) {
      where.sentAt = {};
      if (startDate) where.sentAt.gte = new Date(startDate as string);
      if (endDate) where.sentAt.lte = new Date(endDate as string);
    }

    const [outboundMessages, total] = await Promise.all([
      prisma.outboundMessage.findMany({
        where,
        include: {
          project: { select: { name: true } },
          vendor: { select: { name: true, slug: true } },
          channel: { select: { name: true, type: true } },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.outboundMessage.count({ where }),
    ]);

    res.json({
      success: true,
      data: outboundMessages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Error fetching outbound messages:', error);
    next(error);
  }
};

/**
 * Get message lifecycle - Match outbound with webhook events
 * GET /api/outbound/:vendorRefId/lifecycle
 */
export const getMessageLifecycle = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { vendorRefId } = req.params;

    if (!vendorRefId) {
      res.status(400).json({ error: 'vendorRefId is required' });
      return;
    }

    // Find outbound message
    const outboundMessage = await prisma.outboundMessage.findFirst({
      where: {
        vendorRefId,
        userId,
      },
      include: {
        project: { select: { name: true } },
        vendor: { select: { name: true, slug: true } },
        channel: { select: { name: true, type: true } },
      },
    });

    // Find related webhook events
    const webhookEvents = await prisma.messageEvent.findMany({
      where: {
        vendorRefId,
        message: { userId },
      },
      include: {
        message: {
          select: {
            recipient: true,
            contentSummary: true,
          },
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    // Build lifecycle timeline
    const timeline = [];

    if (outboundMessage) {
      timeline.push({
        type: 'outbound',
        status: 'logged',
        timestamp: outboundMessage.sentAt,
        data: {
          content: outboundMessage.content,
          recipient: outboundMessage.recipient,
        },
      });
    }

    for (const event of webhookEvents) {
      timeline.push({
        type: 'webhook',
        status: event.status,
        timestamp: event.timestamp,
        data: {
          reason: event.reason,
          rawPayload: event.rawPayload ? JSON.parse(event.rawPayload) : null,
        },
      });
    }

    // Sort by timestamp
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Determine current status
    const latestEvent = webhookEvents[webhookEvents.length - 1];
    const currentStatus = latestEvent?.status || (outboundMessage ? 'pending' : 'unknown');

    res.json({
      success: true,
      data: {
        vendorRefId,
        outboundMessage,
        webhookEvents,
        timeline,
        currentStatus,
        totalEvents: webhookEvents.length,
      },
    });
  } catch (error) {
    logger.error('Error fetching message lifecycle:', error);
    next(error);
  }
};

/**
 * Delete an outbound message
 * DELETE /api/outbound/:id
 */
export const deleteOutboundMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Message ID is required' });
      return;
    }

    const outboundMessage = await prisma.outboundMessage.findFirst({
      where: { id, userId },
    });

    if (!outboundMessage) {
      res.status(404).json({ error: 'Outbound message not found' });
      return;
    }

    await prisma.outboundMessage.delete({ where: { id: outboundMessage.id } });

    res.json({
      success: true,
      message: 'Outbound message deleted',
    });
  } catch (error) {
    logger.error('Error deleting outbound message:', error);
    next(error);
  }
};
