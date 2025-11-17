// Script to fix existing mapping issues in the database
// Run this with: node fix-mapping.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

function mapEventNameToCorrectStatus(eventName) {
  if (!eventName) return null;
  
  const eventMap = {
    'delivered': 'delivered',
    'sent': 'sent',
    'failed': 'failed',
    'rejected': 'failed',
    'undelivered': 'failed',
    'expired': 'failed',
    'unknown': 'failed',
    'read': 'read',
    'pending': 'sent',
    'queued': 'sent',
    'error': 'failed',
  };
  
  return eventMap[eventName.toLowerCase()] || null;
}

async function fixMappingIssues() {
  try {
    console.log('🔧 Starting database mapping fix...\n');

    // Get all message events with raw payload
    const events = await prisma.messageEvent.findMany({
      where: {
        rawPayload: {
          not: null,
        },
      },
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
    });

    console.log(`📊 Found ${events.length} events to check\n`);

    let fixedCount = 0;
    const fixes = [];

    for (const event of events) {
      try {
        const payload = JSON.parse(event.rawPayload);
        const eventName = payload.eventName;
        const currentStatus = event.status;
        const correctStatus = mapEventNameToCorrectStatus(eventName);

        if (correctStatus && correctStatus !== currentStatus) {
          fixes.push({
            eventId: event.id,
            eventName,
            currentStatus,
            correctStatus,
            vendor: event.message.vendor.name,
            channel: event.message.channel.type,
          });
        }
      } catch (error) {
        console.warn(`⚠️ Could not parse payload for event ${event.id}`);
      }
    }

    console.log(`🔍 Found ${fixes.length} events that need fixing:\n`);

    // Show what will be fixed
    fixes.slice(0, 10).forEach((fix, index) => {
      console.log(`${index + 1}. Event ${fix.eventId} (${fix.vendor}_${fix.channel})`);
      console.log(`   eventName: "${fix.eventName}"`);
      console.log(`   ${fix.currentStatus} → ${fix.correctStatus}`);
      console.log('');
    });

    if (fixes.length > 10) {
      console.log(`   ... and ${fixes.length - 10} more events\n`);
    }

    // Ask for confirmation (in real scenario)
    console.log('🚨 APPLYING FIXES...\n');

    // Apply fixes in batches
    const batchSize = 10;
    for (let i = 0; i < fixes.length; i += batchSize) {
      const batch = fixes.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(fix => 
          prisma.messageEvent.update({
            where: { id: fix.eventId },
            data: { status: fix.correctStatus },
          })
        )
      );
      
      fixedCount += batch.length;
      console.log(`✅ Fixed batch ${Math.ceil((i + 1) / batchSize)} - ${fixedCount}/${fixes.length} events updated`);
    }

    console.log(`\n🎉 Successfully fixed ${fixedCount} events!`);
    
    // Show summary
    const statusCounts = fixes.reduce((acc, fix) => {
      acc[fix.correctStatus] = (acc[fix.correctStatus] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📊 FIXED STATUS DISTRIBUTION:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count} events`);
    });

  } catch (error) {
    console.error('❌ Error fixing mapping issues:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixMappingIssues();