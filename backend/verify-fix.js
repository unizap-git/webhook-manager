// Quick verification of specific record updates
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyFix() {
  try {
    // Get a few specific events that were mentioned in the fix
    const sampleEvents = await prisma.messageEvent.findMany({
      where: {
        id: {
          in: [
            'cmhvv1tmg000h3ktdc74n49vp', // This was "Delivered" → sent → delivered
            'cmhvuytu5000b3ktd8ebelzn5', // This was "Failed" → delivered → failed
          ]
        }
      },
      select: {
        id: true,
        status: true,
        rawPayload: true,
        timestamp: true,
      }
    });

    console.log('🔍 Verification of specific updated records:\n');
    
    sampleEvents.forEach(event => {
      const payload = JSON.parse(event.rawPayload);
      console.log(`Event ID: ${event.id}`);
      console.log(`Raw eventName: "${payload.eventName}"`);
      console.log(`Current DB status: "${event.status}"`);
      console.log(`Created: ${event.timestamp}`);
      console.log('---');
    });

    // Also show current counts
    const statusCounts = await prisma.messageEvent.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    console.log('\n📊 Current status distribution in database:');
    statusCounts.forEach(({ status, _count }) => {
      console.log(`   ${status}: ${_count.status} events`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyFix();