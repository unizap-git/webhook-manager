import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { webhookQueue } from '../workers';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export const receiveWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { project: projectName, vendor: vendorName, channel: channelName } = req.params;
    const { token } = req.query;
    const webhookData = req.body;

    // Basic validation
    if (!projectName || !vendorName || !channelName) {
      return res.status(400).json({
        error: 'Invalid webhook URL format. Expected: /webhook/{project}/{vendor}/{channel}',
      });
    }

    logger.info(`Received webhook for project ${projectName}, vendor ${vendorName}, channel ${channelName}`);

    // Find the project, vendor, and channel combination
    const projectData = await prisma.project.findFirst({
      where: {
        name: projectName,
      },
      include: {
        vendors: {
          where: {
            name: vendorName,
          },
        },
        channels: {
          where: {
            name: channelName,
          },
        },
      },
    });

    if (!projectData) {
      return res.status(404).json({
        error: `Project '${projectName}' not found`,
      });
    }

    const vendor = projectData.vendors.find(v => v.name === vendorName);
    if (!vendor) {
      return res.status(404).json({
        error: `Vendor '${vendorName}' not found in project '${projectName}'`,
      });
    }

    const channel = projectData.channels.find(c => c.name === channelName);
    if (!channel) {
      return res.status(404).json({
        error: `Channel '${channelName}' not found in project '${projectName}'`,
      });
    }

    // Get the user-vendor-channel mapping to find the user
    const userVendorChannel = await prisma.userVendorChannel.findFirst({
      where: {
        projectId: projectData.id,
        vendorId: vendor.id,
        channelId: channel.id,
      },
      include: {
        user: true,
      },
    });

    if (!userVendorChannel) {
      return res.status(404).json({
        error: `No user mapping found for project '${projectName}', vendor '${vendorName}', channel '${channelName}'`,
      });
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
            vendor: vendorName,
            channel: channelName,
            projectId: projectData.id,
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
          vendorName, 
          channelName, 
          projectData.id,
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
        vendorName, 
        channelName, 
        projectData.id,
        vendor.id,
        channel.id
      );
    }

    // Respond quickly to the webhook sender
    res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
      project: projectName,
      vendor: vendorName,
      channel: channelName,
    });
  } catch (error) {
    logger.error('Webhook receive error:', error);
    next(error);
  }
};