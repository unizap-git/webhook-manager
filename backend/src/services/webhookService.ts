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
  channelType: string,
  projectId?: string,
  vendorId?: string,
  channelId?: string
) {
  try {
    // Verify user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    let vendor, channel;

    // If IDs are provided (new project-based routing), use them
    if (vendorId && channelId && projectId) {
      vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
      });
      channel = await prisma.channel.findUnique({
        where: { id: channelId },
      });
    } else {
      // Fallback to old slug-based lookup for backward compatibility
      vendor = await prisma.vendor.findFirst({
        where: { slug: vendorSlug },
      });
      channel = await prisma.channel.findFirst({
        where: { type: channelType },
      });
    }

    if (!vendor || !channel) {
      throw new Error(`Vendor or channel not found: ${vendorSlug}/${channelType}`);
    }

    // Verify webhook URL exists for this user-vendor-channel combination
    let config;
    if (projectId) {
      config = await prisma.userVendorChannel.findFirst({
        where: {
          userId,
          vendorId: vendor.id,
          channelId: channel.id,
          projectId,
        },
      });
    } else {
      // Fallback for old format
      config = await prisma.userVendorChannel.findFirst({
        where: {
          userId,
          vendorId: vendor.id,
          channelId: channel.id,
        },
      });
    }

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
    let whereClause: any = {
      userId,
      vendorId: vendor.id,
      channelId: channel.id,
      messageId: parsedData.messageId,
    };

    if (projectId) {
      whereClause.projectId = projectId;
    }

    let message = await prisma.message.findFirst({
      where: whereClause,
    });

    if (!message) {
      message = await prisma.message.create({
        data: {
          userId,
          vendorId: vendor.id,
          channelId: channel.id,
          projectId: projectId || config.projectId, // Use provided projectId or fallback to config
          recipient: parsedData.recipient || 'unknown',
          messageId: parsedData.messageId || `${Date.now()}`,
          contentSummary: parsedData.contentSummary || 'No content summary',
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
    await updateAnalyticsCache(userId, vendor.id, channel.id, projectId || config.projectId);

  } catch (error) {
    logger.error('Webhook processing error:', error);
    throw error;
  }
}

function parseMsg91Webhook(data: WebhookPayload, channelType: string) {
  // MSG91 webhook format parsing - Updated for new payload structure
  console.log('Parsing Msg91 webhook:', JSON.stringify(data, null, 2));
  console.log('Channel type:', channelType);

  // Extract message ID based on channel type
  const messageId = data.requestId || data.messageId || data.id || data.UUID || 'unknown';
  
  // Extract recipient based on channel type
  let recipient: string;
  if (channelType === 'sms') {
    recipient = data.telNum || data.number || data.to || 'unknown';
  } else if (channelType === 'whatsapp') {
    recipient = data.customerNumber || data.integratedNumber || data.to || 'unknown';
  } else {
    recipient = data.number || data.telNum || data.customerNumber || data.to || data.recipient || 'unknown';
  }

  // Map eventName to our internal status
  const status = mapMsg91EventName(data.eventName, data.status);
  
  // Extract content summary based on channel type
  let contentSummary: string | undefined;
  if (channelType === 'whatsapp' && data.content) {
    try {
      const contentObj = JSON.parse(data.content);
      contentSummary = contentObj.text?.substring(0, 100);
    } catch {
      contentSummary = data.content.substring(0, 100);
    }
  } else {
    contentSummary = data.text?.substring(0, 100) || data.message?.substring(0, 100);
  }

  // Extract timestamp
  const timestamp = data.ts || data.deliveryTime || data.requestedAt || data.timestamp;
  
  return {
    messageId,
    status,
    recipient,
    reason: data.failureReason || data.reason || data.error || '',
    timestamp: timestamp ? new Date(timestamp) : new Date(),
    contentSummary,
    eventName: data.eventName, // Keep original eventName for analytics
    vendorData: {
      campaignName: data.campaignName,
      senderId: data.senderId,
      route: data.route,
      credit: data.credit,
      smsLength: data.smsLength,
      templateName: data.templateName,
      direction: data.direction,
      companyId: data.companyId,
    },
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
function mapMsg91EventName(eventName: string, fallbackStatus?: string): string {
  // Map MSG91 eventName to our internal status
  if (!eventName) {
    // Fallback to old status mapping if eventName is not present
    return mapMsg91Status(fallbackStatus || '1');
  }
  
  const eventMap: { [key: string]: string } = {
    // SMS Events (capitalized from Msg91)
    'delivered': 'delivered',
    'sent': 'sent', 
    'failed': 'failed',
    'rejected': 'failed',
    'undelivered': 'failed',
    'expired': 'failed',
    'unknown': 'failed',
    
    // WhatsApp Events (lowercase from Msg91)
    'read': 'read',
    
    // Common Events
    'pending': 'sent',
    'queued': 'sent',
    'error': 'failed',
  };
  
  const normalizedEventName = eventName.toLowerCase();
  const mappedStatus = eventMap[normalizedEventName];
  
  if (mappedStatus) {
    console.log(`🔄 Mapping eventName "${eventName}" → status "${mappedStatus}"`);
    return mappedStatus;
  }
  
  console.warn(`⚠️ Unknown eventName "${eventName}", defaulting to 'sent'`);
  return 'sent';
}

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

async function updateAnalyticsCache(userId: string, vendorId: string, channelId: string, projectId?: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get message counts for today
    let whereClause: any = {
      message: {
        userId,
        vendorId,
        channelId,
      },
      timestamp: {
        gte: today,
      },
    };

    if (projectId) {
      whereClause.message.projectId = projectId;
    }

    const counts = await prisma.messageEvent.groupBy({
      by: ['status'],
      where: whereClause,
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

    // Build cache where clause
    let cacheWhereClause: any = {
      userId,
      vendorId,
      channelId,
      date: today,
    };

    if (projectId) {
      cacheWhereClause.projectId = projectId;
    }

    // Build cache data
    let cacheData: any = {
      userId,
      vendorId,
      channelId,
      date: today,
      totalSent,
      totalDelivered,
      totalRead,
      totalFailed,
      successRate,
    };

    if (projectId) {
      cacheData.projectId = projectId;
    }

    // Upsert analytics cache
    await prisma.analyticsCache.upsert({
      where: {
        userId_vendorId_channelId_projectId_date: cacheWhereClause,
      },
      create: cacheData,
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