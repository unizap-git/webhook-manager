import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

// Vendor-specific field mappings for extracting reference IDs
const VENDOR_REF_FIELD_MAP: Record<string, Record<string, string[]>> = {
  'msg91': {
    'sms': ['requestId', 'messageId', 'id', 'UUID'],
    'whatsapp': ['requestId', 'messageId', 'id', 'UUID'],
  },
  'sendgrid': {
    'email': ['sg_message_id', 'message_id', 'smtp_id', 'smtp-id', 'sg_event_id'],
  },
  'aisensy': {
    'whatsapp': ['messageId', 'id'],
  },
  'karix': {
    'sms': ['uid', 'message_id', 'id'],
    'whatsapp': ['uid', 'message_id', 'id'],
  },
};

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

/**
 * Extract vendor reference ID from raw payload
 */
function extractVendorRefId(
  rawPayload: string | null,
  vendorSlug: string,
  channelType: string
): string | null {
  if (!rawPayload) return null;

  try {
    const payload = JSON.parse(rawPayload);
    const vendorFields = VENDOR_REF_FIELD_MAP[vendorSlug.toLowerCase()];

    if (!vendorFields) return null;

    const channelFields = vendorFields[channelType.toLowerCase()];
    if (!channelFields) {
      const defaultFields = Object.values(vendorFields)[0];
      if (!defaultFields) return null;

      for (const field of defaultFields) {
        if (payload[field]) return String(payload[field]);
      }
      return null;
    }

    for (const field of channelFields) {
      if (payload[field]) return String(payload[field]);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Backfill vendor_ref_id for existing message events
 * POST /api/outbound/admin/backfill
 * Requires PARENT account type
 */
export const backfillVendorRefIds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const accountType = req.user?.accountType;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Only allow PARENT accounts to run backfill
    if (accountType !== 'PARENT') {
      res.status(403).json({ error: 'Only parent accounts can run backfill' });
      return;
    }

    // Check current status first
    const withRefId = await prisma.messageEvent.count({
      where: { vendorRefId: { not: null } },
    });

    const withoutRefId = await prisma.messageEvent.count({
      where: { vendorRefId: null, rawPayload: { not: null } },
    });

    if (withoutRefId === 0) {
      res.json({
        success: true,
        message: 'No records to backfill',
        stats: {
          alreadyPopulated: withRefId,
          needsBackfill: 0,
          processed: 0,
          updated: 0,
        },
      });
      return;
    }

    // Process in batches
    const BATCH_SIZE = 100;
    let processed = 0;
    let updated = 0;

    while (processed < withoutRefId) {
      const events = await prisma.messageEvent.findMany({
        where: {
          vendorRefId: null,
          rawPayload: { not: null },
        },
        include: {
          message: {
            include: {
              vendor: true,
              channel: true,
            },
          },
        },
        take: BATCH_SIZE,
      });

      if (events.length === 0) break;

      for (const event of events) {
        const vendorSlug = event.message.vendor.slug;
        const channelType = event.message.channel.type;

        const vendorRefId = extractVendorRefId(
          event.rawPayload,
          vendorSlug,
          channelType
        );

        if (vendorRefId) {
          await prisma.messageEvent.update({
            where: { id: event.id },
            data: { vendorRefId },
          });
          updated++;
        }

        processed++;
      }
    }

    logger.info(`Backfill complete: ${updated}/${processed} events updated`);

    res.json({
      success: true,
      message: 'Backfill complete',
      stats: {
        alreadyPopulated: withRefId,
        needsBackfill: withoutRefId,
        processed,
        updated,
      },
    });
  } catch (error) {
    logger.error('Backfill error:', error);
    next(error);
  }
};

/**
 * Get backfill status
 * GET /api/outbound/admin/backfill-status
 */
export const getBackfillStatus = async (
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

    const [withRefId, withoutRefId, total] = await Promise.all([
      prisma.messageEvent.count({ where: { vendorRefId: { not: null } } }),
      prisma.messageEvent.count({ where: { vendorRefId: null } }),
      prisma.messageEvent.count(),
    ]);

    res.json({
      success: true,
      data: {
        total,
        withVendorRefId: withRefId,
        withoutVendorRefId: withoutRefId,
        percentComplete: total > 0 ? Math.round((withRefId / total) * 100) : 100,
      },
    });
  } catch (error) {
    logger.error('Backfill status error:', error);
    next(error);
  }
};
