import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createHmac } from 'crypto';

interface WebhookPayload {
  [key: string]: any;
}

// Vendor-specific webhook parsers
const webhookParsers = {
  msg91: parseMsg91Webhook,
  MSG91: parseMsg91Webhook, // Alias for case-insensitive lookup
  karix: parseKarixWebhook,
  aisensy: parseAisensyWebhook,
  AiSensy: parseAisensyWebhook, // Alias for case-insensitive lookup
  sendgrid: parseSendGridWebhook,
  SendGrid: parseSendGridWebhook, // Alias for case-insensitive lookup
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

    // Special handling for SendGrid which sends arrays of events
    if (vendorSlug.toLowerCase() === 'sendgrid' && Array.isArray(webhookData)) {
      // Process each event in the SendGrid array
      let processedEvents = 0;
      for (const event of webhookData) {
        const parsedData = parser(event, channelType);
        
        // Create or update message for each event
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
              projectId: projectId || config.projectId,
              recipient: parsedData.recipient || 'unknown',
              messageId: parsedData.messageId || `${Date.now()}`,
              contentSummary: parsedData.contentSummary || 'No content summary',
            },
          });
        }

        // Create message event for each SendGrid event
        await prisma.messageEvent.create({
          data: {
            messageId: message.id,
            vendorRefId: parsedData.messageId || null, // Store vendor reference ID
            status: parsedData.status,
            reason: parsedData.reason,
            timestamp: parsedData.timestamp || new Date(),
            rawPayload: JSON.stringify(event),
            // Denormalized fields for query optimization
            userId,
            vendorId: vendor.id,
            channelId: channel.id,
            projectId: projectId || config.projectId,
          },
        });

        processedEvents++;
      }
      
      logger.info(`📨 ${vendor.name}: processed ${processedEvents} events for message ${webhookData[0]?.sg_message_id}`);
      
      // Update analytics cache once for all events
      await updateAnalyticsCache(userId, vendor.id, channel.id, projectId || config.projectId);
      return;
    }

    // For other vendors (single event processing)
    const parsedData = parser(webhookData, channelType);

    // Special handling for AiSensy project mapping
    let resolvedProjectId = projectId || config.projectId;
    if (vendorSlug.toLowerCase() === 'aisensy' && (parsedData as any).projectId) {
      // Try to map AiSensy project_id to our project system
      const aisensyProject = await prisma.project.findFirst({
        where: {
          userId,
          // Try to match by external project ID or name
          OR: [
            { name: (parsedData as any).projectId },
            { description: { contains: (parsedData as any).projectId } }
          ]
        }
      });

      if (aisensyProject) {
        resolvedProjectId = aisensyProject.id;
        logger.info(`🔗 AiSensy: mapped project_id "${(parsedData as any).projectId}" to project "${aisensyProject.name}"`);
      } else {
        logger.warn(`⚠️ AiSensy: unknown project_id "${(parsedData as any).projectId}", using default project`);
      }
    }

    // Create or update message
    let whereClause: any = {
      userId,
      vendorId: vendor.id,
      channelId: channel.id,
      messageId: parsedData.messageId,
    };

    if (resolvedProjectId) {
      whereClause.projectId = resolvedProjectId;
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
          projectId: resolvedProjectId, // Use resolved project ID
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
        vendorRefId: parsedData.messageId || null, // Store vendor reference ID
        status: parsedData.status,
        reason: parsedData.reason,
        timestamp: parsedData.timestamp || new Date(),
        rawPayload: JSON.stringify(webhookData),
        // Denormalized fields for query optimization
        userId,
        vendorId: vendor.id,
        channelId: channel.id,
        projectId: resolvedProjectId,
      },
    });

    logger.info(`📨 ${vendor.name}: ${parsedData.status} | ${parsedData.messageId}`);

    // Update analytics cache (could be done in a separate job)
    await updateAnalyticsCache(userId, vendor.id, channel.id, resolvedProjectId);

  } catch (error) {
    logger.error('Webhook processing error:', error);
    throw error;
  }
}

function parseMsg91Webhook(data: WebhookPayload, channelType: string) {
  // MSG91 webhook format parsing - Updated for new payload structure

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
  // Actual Karix payload structure:
  // {
  //   events: { mid, timestamp, eventType, date },
  //   notificationAttributes: { status, reason, code },
  //   recipient: { to, recipient_type },
  //   sender: { from },
  //   templateId, channel, ...
  // }

  // Extract message ID - 'mid' is the unique identifier in Karix
  const messageId = data.events?.mid || data.mid || data.uid || data.message_id || data.id;

  // Extract status from notificationAttributes or fallback to direct status
  const rawStatus = data.notificationAttributes?.status || data.status || data.delivery_status;
  const status = mapKarixStatus(rawStatus);

  // Extract recipient - can be in recipient.to or direct fields
  const recipient = data.recipient?.to || data.destination || data.to || data.recipient;

  // Extract reason from notificationAttributes
  const reason = data.notificationAttributes?.reason || data.reason || data.error_message;

  // Parse timestamp - Karix sends timestamp in milliseconds as string
  let timestamp = new Date();
  if (data.events?.timestamp) {
    const ts = parseInt(data.events.timestamp, 10);
    if (!isNaN(ts)) {
      timestamp = new Date(ts);
    }
  } else if (data.created_time) {
    timestamp = new Date(data.created_time);
  }

  // Build content summary from available fields
  const contentSummary = data.templateId
    ? `Template: ${data.templateId}`
    : data.text?.substring(0, 100);

  return {
    messageId,
    status,
    recipient,
    reason,
    timestamp,
    contentSummary,
  };
}

function parseAisensyWebhook(data: WebhookPayload, channelType: string) {
  // AiSensy webhook format parsing
  // Handle both message.created and message.status.updated events
  const messageData = data.message || data;
  
  // Use messageId as primary identifier (as per requirements)
  const messageId = messageData.messageId || messageData.id;
  
  // Map AiSensy status to our standard statuses
  const status = mapAisensyStatus(messageData.status);
  
  // Use phone_number as recipient
  const recipient = messageData.phone_number;
  
  // Get appropriate timestamp based on current status
  let timestamp = new Date();
  if (messageData.sent_at && status === 'sent') {
    timestamp = new Date(messageData.sent_at);
  } else if (messageData.delivered_at && status === 'delivered') {
    timestamp = new Date(messageData.delivered_at);
  } else if (messageData.read_at && status === 'read') {
    timestamp = new Date(messageData.read_at);
  } else if (messageData.failed_at && status === 'failed') {
    timestamp = new Date(messageData.failed_at);
  }
  
  // Extract failure reason if present
  const failureReason = messageData.failureResponse?.reason || 
                        messageData.failureResponse?.code;
  
  // Create content summary from message type and content
  let contentSummary = `${messageData.message_type || 'MESSAGE'}`;
  if (messageData.message_content) {
    const contentStr = typeof messageData.message_content === 'object' 
      ? JSON.stringify(messageData.message_content) 
      : messageData.message_content;
    contentSummary += `: ${contentStr.substring(0, 100)}`;
  }
  
  return {
    messageId,
    status,
    recipient,
    reason: failureReason,
    timestamp,
    contentSummary: contentSummary.substring(0, 100),
    // Store additional AiSensy-specific data
    projectId: messageData.project_id, // For auto-mapping
    contactId: messageData.contact_id,
    messageType: messageData.message_type,
  };
}

function parseSendGridWebhook(data: WebhookPayload, channelType: string) {
  // SendGrid webhook format parsing
  // Note: This function now receives individual events, not arrays
  const event = data; // Single event object
  
  // Try multiple possible message ID fields from SendGrid
  const messageId = event.sg_message_id || 
                   event['sg_message_id'] || 
                   event.message_id || 
                   event.smtp_id || 
                   event['smtp-id'] ||
                   event.sg_event_id ||
                   event['sg_event_id'] ||
                   event.unique_id ||
                   'unknown';
  
  const status = mapSendGridStatus(event.event);
  const recipient = event.email || event.to;
  
  return {
    messageId,
    status,
    recipient,
    reason: event.reason || event.response,
    timestamp: event.timestamp ? new Date(event.timestamp * 1000) : new Date(),
    contentSummary: event.subject ? event.subject.substring(0, 100) : undefined,
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
    return mappedStatus;
  }
  
  logger.warn(`📱 Unknown MSG91 event: ${eventName}`);
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
    // Standard statuses
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'failed': 'failed',
    
    // Common variations
    'pending': 'sent',
    'queued': 'sent',
    'sending': 'sent',
    'accepted': 'sent',
    
    // Error states
    'error': 'failed',
    'rejected': 'failed',
    'bounced': 'failed',
    'blocked': 'failed',
    'invalid': 'failed',
    
    // WhatsApp specific statuses
    'enroute': 'sent',
    'received': 'delivered',
    'seen': 'read',
    'clicked': 'read',
  };
  
  // If status is not mapped, return it as-is for future analysis
  return statusMap[status?.toLowerCase()] || status?.toLowerCase() || 'sent';
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
    'spamreport': 'failed', // Alternative format
    'unsubscribe': 'delivered',
    'group_unsubscribe': 'delivered',
    'group_resubscribe': 'delivered',
  };
  
  return statusMap[event?.toLowerCase()] || 'sent';
}

async function updateAnalyticsCache(userId: string, vendorId: string, channelId: string, projectId?: string) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get message counts for today using denormalized fields (no JOIN needed)
    let whereClause: any = {
      userId,
      vendorId,
      channelId,
      timestamp: {
        gte: today,
      },
    };

    if (projectId) {
      whereClause.projectId = projectId;
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

// Webhook signature verification functions
export function verifyAisensySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    // Generate HMAC-SHA256 signature
    const generatedSignature = createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    // Compare signatures (time-safe comparison)
    return signature === generatedSignature;
  } catch (error) {
    logger.error('AiSensy signature verification failed:', error);
    return false;
  }
}

export function verifyWebhookSignature(
  vendor: string,
  payload: string,
  signature: string,
  secret: string
): boolean {
  switch (vendor.toLowerCase()) {
    case 'aisensy':
      return verifyAisensySignature(payload, signature, secret);
    default:
      logger.warn(`No signature verification implemented for vendor: ${vendor}`);
      return true; // Allow through for vendors without signature verification
  }
}