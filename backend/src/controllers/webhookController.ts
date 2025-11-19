import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { webhookQueue } from '../workers';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const receiveWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project: projectName, vendor: vendorSlug, channel: channelType } = req.params;
    const { token } = req.query;
    const webhookData = req.body;

    // Basic validation
    if (!projectName || !vendorSlug || !channelType) {
      return res.status(400).json({
        error: 'Invalid webhook URL format. Expected: /webhook/{project}/{vendor}/{channel}',
      });
    }

    logger.info(`Received webhook for project ${projectName}, vendor ${vendorSlug}, channel ${channelType}`);

    // Find the project
    const project = await (prisma as any).project.findFirst({
      where: {
        name: projectName,
      },
    });

    if (!project) {
      return res.status(404).json({
        error: `Project '${projectName}' not found`,
      });
    }

    // Find the global vendor by slug
    const vendor = await (prisma as any).vendor.findFirst({
      where: {
        slug: vendorSlug,
        isActive: true,
      },
    });

    if (!vendor) {
      return res.status(404).json({
        error: `Vendor '${vendorSlug}' not found or inactive`,
      });
    }

    // Find the global channel by type
    const channel = await (prisma as any).channel.findFirst({
      where: {
        type: channelType,
        isActive: true,
      },
    });

    if (!channel) {
      return res.status(404).json({
        error: `Channel '${channelType}' not found or inactive`,
      });
    }

    // Get the user-vendor-channel mapping for this specific combination
    const userVendorChannel = await (prisma as any).userVendorChannel.findFirst({
      where: {
        projectId: project.id,
        vendorId: vendor.id,
        channelId: channel.id,
      },
      include: {
        user: true,
      },
    });

    if (!userVendorChannel) {
      return res.status(404).json({
        error: `No configuration found for project '${projectName}', vendor '${vendor.name}', channel '${channel.name}'`,
      });
    }

    // Verify webhook token matches (optional security check)
    if (token && userVendorChannel.webhookUrl) {
      const urlToken = new URL(userVendorChannel.webhookUrl).searchParams.get('token');
      if (urlToken !== token) {
        return res.status(401).json({
          error: 'Invalid webhook token',
        });
      }
    }

    // Verify webhook signature for vendors that support it
    if (vendorSlug.toLowerCase() === 'aisensy' && userVendorChannel.webhookSecret) {
      const signature = req.headers['x-aisensy-signature'] as string;
      if (signature) {
        const { verifyWebhookSignature } = await import('../services/webhookService');
        const rawBody = JSON.stringify(webhookData);
        
        if (!verifyWebhookSignature(vendorSlug, rawBody, signature, userVendorChannel.webhookSecret)) {
          return res.status(401).json({
            error: 'Invalid webhook signature',
          });
        }
        
        logger.info(`✅ ${vendor.name}: Webhook signature verified`);
      } else if (userVendorChannel.webhookSecret) {
        logger.warn(`⚠️ ${vendor.name}: No signature provided but secret is configured`);
      }
    }

    const userId = userVendorChannel.userId;

    // Try to add to processing queue, fallback to direct processing if Redis unavailable
    try {
      if (webhookQueue) {
        await webhookQueue.add(
          'process-webhook',
          {
            webhookData,
            userId,
            vendor: vendor.slug,
            channel: channel.type,
            projectId: project.id,
            vendorId: vendor.id,
            channelId: channel.id,
            token,
            timestamp: new Date().toISOString(),
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          }
        );
      } else {
        // Process directly if Redis is not available
        const { processWebhookPayload } = await import('../services/webhookService');
        await processWebhookPayload(
          webhookData, 
          userId, 
          vendor.slug, 
          channel.type, 
          project.id,
          vendor.id,
          channel.id
        );
      }
    } catch (queueError) {
      logger.warn('Queue not available, processing webhook directly:', queueError);
      // Process directly if Redis is not available
      const { processWebhookPayload } = await import('../services/webhookService');
      await processWebhookPayload(
        webhookData, 
        userId, 
        vendor.slug, 
        channel.type, 
        project.id,
        vendor.id,
        channel.id
      );
    }

    // Respond quickly to the webhook sender
    res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
      project: projectName,
      vendor: vendor.name,
      channel: channel.name,
    });
  } catch (error) {
    logger.error('Webhook receive error:', error);
    next(error);
  }
};