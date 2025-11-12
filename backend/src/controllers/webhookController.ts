import { Request, Response, NextFunction } from 'express';
import { webhookQueue } from '../workers';
import { logger } from '../utils/logger';

export const receiveWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, vendor, channel } = req.params;
    const { token } = req.query;
    const webhookData = req.body;

    // Basic validation
    if (!userId || !vendor || !channel) {
      return res.status(400).json({
        error: 'Invalid webhook URL format',
      });
    }

    logger.info(`Received webhook for user ${userId}, vendor ${vendor}, channel ${channel}`);

    // Try to add to processing queue, fallback to direct processing if Redis unavailable
    try {
      if (webhookQueue) {
        await webhookQueue.add(
          'process-webhook',
          {
            webhookData,
            userId,
            vendor,
            channel,
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
        await processWebhookPayload(webhookData, userId, vendor, channel);
      }
    } catch (queueError) {
      logger.warn('Queue not available, processing webhook directly:', queueError);
      // Process directly if Redis is not available
      const { processWebhookPayload } = await import('../services/webhookService');
      await processWebhookPayload(webhookData, userId, vendor, channel);
    }

    // Respond quickly to the webhook sender
    res.status(200).json({
      success: true,
      message: 'Webhook received and processed',
    });
  } catch (error) {
    logger.error('Webhook receive error:', error);
    next(error);
  }
};