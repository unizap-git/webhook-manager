/**
 * Migration Script: Turso (SQLite) → MySQL
 *
 * This script migrates data from Turso to MySQL while preserving foreign key relationships.
 * Uses batch processing and retry logic to handle unstable connections.
 *
 * Prerequisites:
 * 1. Update .env with MySQL DATABASE_URL
 * 2. Run: npx prisma generate
 * 3. Run: npx prisma db push
 * 4. Then run this script: npx tsx scripts/migrate-turso-to-mysql.ts
 */

import { createClient } from '@libsql/client';
import { PrismaClient } from '@prisma/client';

// Turso credentials (from your old .env)
const TURSO_URL = 'libsql://webhook-unizap.aws-ap-south-1.turso.io';
const TURSO_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjM2MTg4MzAsImlkIjoiNTBiMzQzYTgtYzJhMi00N2QwLWJiNTktMmI3MTUwMzY5YTA5IiwicmlkIjoiMzM2NWE0ZGUtN2I0Zi00OWIzLTk3MjUtOTFjZGVjOWUwNzVlIn0.qKUbF7r6Ayds7jPToGMiIorQwtX2zpW7SUcmSZcnSxMk-eOaN3WCbTpVdkdKa2odwPJz3ugrE7LWi1pDZ93AAg';

// Create Turso client
const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

// Create MySQL Prisma client with connection pool settings
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

const BATCH_SIZE = 100; // Process records in batches
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

interface MigrationStats {
  table: string;
  count: number;
  success: number;
  failed: number;
  skipped: number;
}

const stats: MigrationStats[] = [];

// Helper to sleep
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to convert SQLite boolean (0/1) to JavaScript boolean
function toBool(value: any): boolean {
  return value === 1 || value === '1' || value === true;
}

// Helper to convert SQLite date string to Date object
function toDate(value: any): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return new Date(value);
}

// Retry wrapper with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  attempts: number = RETRY_ATTEMPTS
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      if (i < attempts - 1) {
        const delay = RETRY_DELAY_MS * Math.pow(2, i);
        console.log(`   Retry ${i + 1}/${attempts} after ${delay}ms...`);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

async function migrateTableBatched<T>(
  tableName: string,
  fetchQuery: string,
  transformFn: (row: any) => any,
  createFn: (data: any) => Promise<void>
): Promise<void> {
  console.log(`\n📦 Migrating ${tableName}...`);

  const tableStats: MigrationStats = {
    table: tableName,
    count: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const result = await turso.execute(fetchQuery);
    tableStats.count = result.rows.length;

    console.log(`   Found ${result.rows.length} records`);

    // Process in batches
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(result.rows.length / BATCH_SIZE);

      process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, result.rows.length)})...`);

      for (const row of batch) {
        try {
          const data = transformFn(row);
          await withRetry(async () => {
            await createFn(data);
          });
          tableStats.success++;
        } catch (error: any) {
          // Skip duplicates (already migrated)
          if (error.code === 'P2002') {
            tableStats.skipped++;
          } else {
            tableStats.failed++;
            // Log first few errors only
            if (tableStats.failed <= 3) {
              console.error(`\n   ❌ Error: ${error.message.split('\n')[0]}`);
            }
          }
        }
      }

      console.log(` ✓`);

      // Small delay between batches to avoid overwhelming MySQL
      if (i + BATCH_SIZE < result.rows.length) {
        await sleep(100);
      }
    }

    console.log(`   ✅ Migrated ${tableStats.success}/${tableStats.count} (${tableStats.skipped} skipped, ${tableStats.failed} failed)`);
  } catch (error) {
    console.error(`   ❌ Error migrating ${tableName}:`, error);
  }

  stats.push(tableStats);
}

// Bulk insert using createMany for large tables
async function migrateTableBulk<T>(
  tableName: string,
  fetchQuery: string,
  transformFn: (row: any) => any,
  createManyFn: (data: any[]) => Promise<void>
): Promise<void> {
  console.log(`\n📦 Migrating ${tableName} (bulk)...`);

  const tableStats: MigrationStats = {
    table: tableName,
    count: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  try {
    const result = await turso.execute(fetchQuery);
    tableStats.count = result.rows.length;

    console.log(`   Found ${result.rows.length} records`);

    // Process in batches using createMany
    for (let i = 0; i < result.rows.length; i += BATCH_SIZE) {
      const batch = result.rows.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(result.rows.length / BATCH_SIZE);

      process.stdout.write(`   Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, result.rows.length)})...`);

      try {
        const data = batch.map(row => transformFn(row));
        await withRetry(async () => {
          await createManyFn(data);
        });
        tableStats.success += batch.length;
        console.log(` ✓`);
      } catch (error: any) {
        // If bulk insert fails (likely duplicates), try individual inserts
        if (error.code === 'P2002' || error.message.includes('Unique constraint')) {
          console.log(` (has duplicates, inserting individually...)`);
          for (const row of batch) {
            try {
              const data = transformFn(row);
              await withRetry(async () => {
                await prisma.$executeRawUnsafe(
                  `INSERT IGNORE INTO ${tableName.replace('_', '')} VALUES (?)`,
                  data
                );
              });
              tableStats.success++;
            } catch (innerError: any) {
              if (innerError.code === 'P2002') {
                tableStats.skipped++;
              } else {
                tableStats.failed++;
              }
            }
          }
        } else {
          tableStats.failed += batch.length;
          console.log(` ❌ ${error.message.split('\n')[0]}`);
        }
      }

      // Delay between batches
      if (i + BATCH_SIZE < result.rows.length) {
        await sleep(200);
      }
    }

    console.log(`   ✅ Migrated ${tableStats.success}/${tableStats.count} (${tableStats.skipped} skipped, ${tableStats.failed} failed)`);
  } catch (error) {
    console.error(`   ❌ Error migrating ${tableName}:`, error);
  }

  stats.push(tableStats);
}

async function main() {
  console.log('🚀 Starting Turso → MySQL Migration (with batching)');
  console.log('====================================================\n');
  console.log(`Batch size: ${BATCH_SIZE}, Retry attempts: ${RETRY_ATTEMPTS}\n`);

  try {
    // Test connections
    console.log('Testing Turso connection...');
    await turso.execute('SELECT 1');
    console.log('✅ Turso connected\n');

    console.log('Testing MySQL connection...');
    await prisma.$connect();
    console.log('✅ MySQL connected\n');

    // Migration order (respects foreign keys)

    // 1. Users (no dependencies)
    await migrateTableBatched(
      'users',
      'SELECT * FROM users',
      (row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        password: row.password,
        accountType: row.account_type || 'PARENT',
        parentId: row.parent_id || null,
        createdAt: toDate(row.created_at),
        updatedAt: toDate(row.updated_at),
      }),
      async (data) => {
        await prisma.user.create({ data });
      }
    );

    // 2. Vendors (no dependencies)
    await migrateTableBatched(
      'vendors',
      'SELECT * FROM vendors',
      (row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        isActive: toBool(row.is_active),
        createdAt: toDate(row.created_at),
      }),
      async (data) => {
        await prisma.vendor.create({ data });
      }
    );

    // 3. Channels (no dependencies)
    await migrateTableBatched(
      'channels',
      'SELECT * FROM channels',
      (row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        description: row.description,
        isActive: toBool(row.is_active),
        createdAt: toDate(row.created_at),
      }),
      async (data) => {
        await prisma.channel.create({ data });
      }
    );

    // 4. Projects (depends on users)
    await migrateTableBatched(
      'projects',
      'SELECT * FROM projects',
      (row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        userId: row.user_id,
        createdAt: toDate(row.created_at),
        updatedAt: toDate(row.updated_at),
      }),
      async (data) => {
        await prisma.project.create({ data });
      }
    );

    // 5. Project Access (depends on projects, users)
    await migrateTableBatched(
      'project_access',
      'SELECT * FROM project_access',
      (row: any) => ({
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        accessType: row.access_type,
        grantedBy: row.granted_by,
        createdAt: toDate(row.created_at),
      }),
      async (data) => {
        await prisma.projectAccess.create({ data });
      }
    );

    // 6. User Vendor Channels (depends on users, vendors, channels, projects)
    await migrateTableBatched(
      'user_vendor_channels',
      'SELECT * FROM user_vendor_channels',
      (row: any) => ({
        id: row.id,
        userId: row.user_id,
        vendorId: row.vendor_id,
        channelId: row.channel_id,
        projectId: row.project_id,
        webhookUrl: row.webhook_url,
        webhookSecret: row.webhook_secret,
        isActive: toBool(row.is_active),
        createdAt: toDate(row.created_at),
      }),
      async (data) => {
        await prisma.userVendorChannel.create({ data });
      }
    );

    // 7. Messages (depends on users, vendors, channels, projects) - LARGE TABLE
    await migrateTableBulk(
      'messages',
      'SELECT * FROM messages',
      (row: any) => ({
        id: row.id,
        userId: row.user_id,
        vendorId: row.vendor_id,
        channelId: row.channel_id,
        projectId: row.project_id,
        recipient: row.recipient,
        messageId: row.message_id,
        contentSummary: row.content_summary,
        createdAt: toDate(row.created_at),
      }),
      async (data) => {
        await prisma.message.createMany({ data, skipDuplicates: true });
      }
    );

    // 8. Message Events (depends on messages) - LARGEST TABLE
    await migrateTableBulk(
      'message_events',
      'SELECT * FROM message_events',
      (row: any) => ({
        id: row.id,
        messageId: row.message_id,
        vendorRefId: row.vendor_ref_id,
        status: row.status,
        reason: row.reason,
        timestamp: toDate(row.timestamp),
        rawPayload: row.raw_payload,
        userId: row.user_id,
        vendorId: row.vendor_id,
        channelId: row.channel_id,
        projectId: row.project_id,
      }),
      async (data) => {
        await prisma.messageEvent.createMany({ data, skipDuplicates: true });
      }
    );

    // 9. Analytics Cache (depends on users, vendors, channels, projects)
    await migrateTableBatched(
      'analytics_cache',
      'SELECT * FROM analytics_cache',
      (row: any) => ({
        id: row.id,
        userId: row.user_id,
        vendorId: row.vendor_id || null,
        channelId: row.channel_id || null,
        projectId: row.project_id || null,
        date: toDate(row.date),
        totalSent: row.total_sent || 0,
        totalDelivered: row.total_delivered || 0,
        totalRead: row.total_read || 0,
        totalFailed: row.total_failed || 0,
        successRate: row.success_rate || 0,
      }),
      async (data) => {
        await prisma.analyticsCache.create({ data });
      }
    );

    // 10. Outbound Messages (depends on users, vendors, channels, projects)
    await migrateTableBulk(
      'outbound_messages',
      'SELECT * FROM outbound_messages',
      (row: any) => ({
        id: row.id,
        userId: row.user_id,
        projectId: row.project_id,
        vendorId: row.vendor_id,
        channelId: row.channel_id,
        vendorRefId: row.vendor_ref_id,
        recipient: row.recipient,
        content: row.content,
        sentAt: toDate(row.sent_at),
        createdAt: toDate(row.created_at),
      }),
      async (data) => {
        await prisma.outboundMessage.createMany({ data, skipDuplicates: true });
      }
    );

    // Print summary
    console.log('\n====================================================');
    console.log('📊 Migration Summary');
    console.log('====================================================');

    let totalCount = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const s of stats) {
      totalCount += s.count;
      totalSuccess += s.success;
      totalFailed += s.failed;
      totalSkipped += s.skipped;
      console.log(`${s.table}: ${s.success}/${s.count} (${s.skipped} skipped, ${s.failed} failed)`);
    }

    console.log('----------------------------------------------------');
    console.log(`Total: ${totalSuccess}/${totalCount} records migrated`);
    console.log(`Skipped (duplicates): ${totalSkipped}`);

    if (totalFailed > 0) {
      console.log(`⚠️  ${totalFailed} records failed to migrate`);
    } else {
      console.log('✅ All records migrated successfully!');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    turso.close();
  }
}

main();
