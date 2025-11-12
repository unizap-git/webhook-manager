import { prisma } from '../config/database';
import { logger } from '../utils/logger';

interface WebhookPayload {
  [key: string]: any;
}

// Vendor-specific webhook parsers
const webhookParsers = {
  msg91: parseMsg91Webhook,
  karix: parseKarixWebhook,
  aisensy: parseAisensyWebhook,
  sendgrid: parseSendGridWebhook,
};

export async function processWebhookPayload(
  webhookData: WebhookPayload,
  userId: string,
  vendorSlug: string,
  channelType: string
) {
  try {
    // Verify user and get vendor/channel info
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const vendor = await prisma.vendor.findUnique({
      where: { slug: vendorSlug },
    });

    const channel = await prisma.channel.findUnique({
      where: { type: channelType },
    });

    if (!vendor || !channel) {
      throw new Error(`Vendor or channel not found: ${vendorSlug}/${channelType}`);
    }

    // Verify webhook URL exists for this user-vendor-channel combination
    const config = await prisma.userVendorChannel.findUnique({
      where: {
        userId_vendorId_channelId: {
          userId,
          vendorId: vendor.id,
          channelId: channel.id,
        },
      },
    });

    if (!config) {
      throw new Error(`No webhook configuration found for user ${userId}, vendor ${vendorSlug}, channel ${channelType}`);
    }

    // Parse webhook data based on vendor
    const parser = webhookParsers[vendorSlug as keyof typeof webhookParsers];
    if (!parser) {
      throw new Error(`No parser available for vendor: ${vendorSlug}`);
    }

    const parsedData = parser(webhookData, channelType);

    // Create or update message
    let message = await prisma.message.findFirst({
      where: {
        userId,
        vendorId: vendor.id,
        channelId: channel.id,
        messageId: parsedData.messageId,
      },
    });

    if (!message) {
      message = await prisma.message.create({
        data: {
          userId,
          vendorId: vendor.id,
          channelId: channel.id,
          recipient: parsedData.recipient,
          messageId: parsedData.messageId,
          contentSummary: parsedData.contentSummary,
        },
      });
    }

    // Create message event
    await prisma.messageEvent.create({
      data: {
        messageId: message.id,
        status: parsedData.status,
        reason: parsedData.reason,
        timestamp: parsedData.timestamp || new Date(),
        rawPayload: JSON.stringify(webhookData),
      },
    });

    logger.info(`Processed webhook for message ${parsedData.messageId}: ${parsedData.status}`);

    // Update analytics cache (could be done in a separate job)
    await updateAnalyticsCache(userId, vendor.id, channel.id);

  } catch (error) {
    logger.error('Webhook processing error:', error);
    throw error;
  }
}

function parseMsg91Webhook(data: WebhookPayload, channelType: string) {
  // MSG91 webhook format parsing
  // This is a simplified implementation - you'll need to adjust based on actual webhook formats
  const messageId = data.requestId || data.messageId || data.id;
  const status = mapMsg91Status(data.status || data.deliveryStatus);
  const recipient = data.number || data.to || data.recipient;
  
  return {
    messageId,
    status,
    recipient,
    reason: data.reason || data.error,
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
    contentSummary: data.text ? data.text.substring(0, 100) : undefined,
  };
}

function parseKarixWebhook(data: WebhookPayload, channelType: string) {
  // Karix webhook format parsing
  const messageId = data.uid || data.message_id || data.id;
  const status = mapKarixStatus(data.status || data.delivery_status);
  const recipient = data.destination || data.to || data.recipient;
  
  return {
    messageId,
    status,
    recipient,
    reason: data.reason || data.error_message,
    timestamp: data.created_time ? new Date(data.created_time) : new Date(),
    contentSummary: data.text ? data.text.substring(0, 100) : undefined,
  };
}

function parseAisensyWebhook(data: WebhookPayload, channelType: string) {
  // AiSensy webhook format parsing
  const messageId = data.messageId || data.id || data.msg_id;
  const status = mapAisensyStatus(data.status || data.message_status);
  const recipient = data.to || data.recipient || data.phone;
  
  return {
    messageId,
    status,
    recipient,
    reason: data.error || data.reason,
    timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date(),
    contentSummary: data.message ? data.message.substring(0, 100) : undefined,
  };
}

function parseSendGridWebhook(data: WebhookPayload, channelType: string) {
  // SendGrid webhook format parsing
  const messageId = data.sg_message_id || data.message_id || data.smtp_id;
  const status = mapSendGridStatus(data.event);
  const recipient = data.email || data.to;
  
  return {
    messageId,
    status,
    recipient,
    reason: data.reason || data.response,
    timestamp: data.timestamp ? new Date(data.timestamp * 1000) : new Date(),
    contentSummary: data.subject ? data.subject.substring(0, 100) : undefined,
  };
}

// Status mapping functions
function mapMsg91Status(status: string): string {
  const statusMap: { [key: string]: string } = {
    '1': 'sent',
    '2': 'delivered',
    '3': 'failed',
    '4': 'failed',
    'delivered': 'delivered',
    'sent': 'sent',
    'failed': 'failed',
    'rejected': 'failed',
  };
  
  return statusMap[status?.toLowerCase()] || 'sent';
}

function mapKarixStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'queued': 'sent',
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed',
    'rejected': 'failed',
  };
  
  return statusMap[status?.toLowerCase()] || 'sent';
}

function mapAisensyStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed',
    'error': 'failed',
  };
  
  return statusMap[status?.toLowerCase()] || 'sent';
}

function mapSendGridStatus(event: string): string {
  const statusMap: { [key: string]: string } = {
    'processed': 'sent',
    'delivered': 'delivered',
    'open': 'read',
    'click': 'read',
    'bounce': 'failed',
    'dropped': 'failed',
    'deferred': 'sent',
    'blocked': 'failed',
    'spam_report': 'failed',
    'unsubscribe': 'delivered',
  };
  
  return statusMap[event?.toLowerCase()] || 'sent';
}

async function updateAnalyticsCache(userId: string, vendorId: string, channelId: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get message counts for today
    const counts = await prisma.messageEvent.groupBy({
      by: ['status'],
      where: {
        message: {
          userId,
          vendorId,
          channelId,
        },
        timestamp: {
          gte: today,
        },
      },
      _count: {
        status: true,
      },
    });

    // Calculate totals
    let totalSent = 0;
    let totalDelivered = 0;
    let totalRead = 0;
    let totalFailed = 0;

    counts.forEach((count) => {
      switch (count.status) {
        case 'sent':
          totalSent = count._count.status;
          break;
        case 'delivered':
          totalDelivered = count._count.status;
          break;
        case 'read':
          totalRead = count._count.status;
          break;
        case 'failed':
          totalFailed = count._count.status;
          break;
      }
    });

    const total = totalSent + totalDelivered + totalRead + totalFailed;
    const successRate = total > 0 ? ((totalDelivered + totalRead) / total) * 100 : 0;

    // Upsert analytics cache
    await prisma.analyticsCache.upsert({
      where: {
        userId_vendorId_channelId_date: {
          userId,
          vendorId,
          channelId,
          date: today,
        },
      },
      create: {
        userId,
        vendorId,
        channelId,
        date: today,
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        successRate,
      },
      update: {
        totalSent,
        totalDelivered,
        totalRead,
        totalFailed,
        successRate,
      },
    });
  } catch (error) {
    logger.error('Analytics cache update error:', error);
    // Don't throw here as this is not critical for webhook processing
  }
}