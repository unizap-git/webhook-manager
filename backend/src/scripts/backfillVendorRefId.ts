/**
 * Backfill Script: Populate vendor_ref_id in message_events table
 *
 * This script extracts vendor reference IDs from raw_payload JSON
 * and populates the vendor_ref_id column for existing records.
 *
 * Usage: npx tsx src/scripts/backfillVendorRefId.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
 * Extract vendor reference ID from raw payload based on vendor and channel
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

    if (!vendorFields) {
      console.warn(`Unknown vendor: ${vendorSlug}`);
      return null;
    }

    const channelFields = vendorFields[channelType.toLowerCase()];
    if (!channelFields) {
      // Try default fields if channel-specific not found
      const defaultFields = Object.values(vendorFields)[0];
      if (!defaultFields) return null;

      for (const field of defaultFields) {
        // Handle nested fields (e.g., message.messageId for AiSensy)
        const value = getNestedValue(payload, field);
        if (value) return String(value);
      }
      return null;
    }

    // Try each possible field in order of priority
    for (const field of channelFields) {
      const value = getNestedValue(payload, field);
      if (value) return String(value);
    }

    return null;
  } catch (error) {
    console.error(`Error parsing raw_payload: ${error}`);
    return null;
  }
}

/**
 * Get nested value from object using dot notation or direct access
 */
function getNestedValue(obj: any, path: string): any {
  // First try direct access
  if (obj[path] !== undefined) return obj[path];

  // Try nested access (e.g., "message.messageId")
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

async function backfillVendorRefIds() {
  console.log('Starting vendor_ref_id backfill...\n');

  // Get count of records to process
  const totalCount = await prisma.messageEvent.count({
    where: {
      vendorRefId: null,
      rawPayload: { not: null },
    },
  });

  console.log(`Found ${totalCount} message events to process\n`);

  if (totalCount === 0) {
    console.log('No records to backfill. Exiting.');
    return;
  }

  const BATCH_SIZE = 100;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches
  while (processed < totalCount) {
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
      skip: 0, // Always take from top since we're updating records
    });

    if (events.length === 0) break;

    for (const event of events) {
      try {
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
        } else {
          // Mark as processed by setting empty string to avoid reprocessing
          // Or we can leave it null and skip
          skipped++;
        }
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        errors++;
      }

      processed++;

      // Progress indicator
      if (processed % 50 === 0) {
        console.log(`Progress: ${processed}/${totalCount} (${Math.round(processed/totalCount*100)}%)`);
      }
    }
  }

  console.log('\n=== Backfill Complete ===');
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Skipped (no ref ID found): ${skipped}`);
  console.log(`Errors: ${errors}`);
}

// Summary function to show vendor distribution
async function showSummary() {
  console.log('\n=== Current Data Summary ===\n');

  const withRefId = await prisma.messageEvent.count({
    where: { vendorRefId: { not: null } },
  });

  const withoutRefId = await prisma.messageEvent.count({
    where: { vendorRefId: null },
  });

  console.log(`Events with vendor_ref_id: ${withRefId}`);
  console.log(`Events without vendor_ref_id: ${withoutRefId}`);

  // Show by vendor
  const eventsByVendor = await prisma.messageEvent.groupBy({
    by: ['messageId'],
    _count: true,
  });

  console.log(`\nTotal unique messages: ${eventsByVendor.length}`);
}

// Main execution
async function main() {
  try {
    await showSummary();
    await backfillVendorRefIds();
    await showSummary();
  } catch (error) {
    console.error('Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
