// Simple script to analyze webhook data in the database
// Run this with: node analyze-db.js

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeWebhookData() {
  try {
    console.log('🔍 Analyzing webhook data...\n');

    // Get all message events with raw payload
    const events = await prisma.messageEvent.findMany({
      include: {
        message: {
          include: {
            vendor: true,
            channel: true,
          },
        },
      },
      orderBy: {
        timestamp: 'desc',
      },
    });

    console.log(`📊 Total events found: ${events.length}\n`);

    // Analyze each event
    const analysis = events.map(event => {
      let parsedPayload = {};
      try {
        parsedPayload = event.rawPayload ? JSON.parse(event.rawPayload) : {};
      } catch (error) {
        parsedPayload = { error: 'Failed to parse JSON' };
      }

      return {
        eventId: event.id,
        timestamp: event.timestamp,
        dbStatus: event.status,
        rawEventName: parsedPayload.eventName,
        rawStatus: parsedPayload.status,
        vendor: event.message.vendor.name,
        channel: event.message.channel.type,
        recipient: event.message.recipient,
        rawPayload: parsedPayload,
        
        // Check mapping
        expectedStatus: mapEventName(parsedPayload.eventName),
        isCorrectMapping: mapEventName(parsedPayload.eventName) === event.status,
      };
    });

    // Show mapping issues
    const mappingIssues = analysis.filter(a => !a.isCorrectMapping);
    
    console.log('❌ MAPPING ISSUES:');
    console.log(`Found ${mappingIssues.length} events with incorrect status mapping:\n`);
    
    mappingIssues.forEach((issue, index) => {
      console.log(`${index + 1}. Event ID: ${issue.eventId}`);
      console.log(`   Raw eventName: "${issue.rawEventName}"`);
      console.log(`   DB Status: "${issue.dbStatus}"`);
      console.log(`   Expected Status: "${issue.expectedStatus}"`);
      console.log(`   Vendor-Channel: ${issue.vendor}_${issue.channel}`);
      console.log(`   Timestamp: ${issue.timestamp}`);
      console.log(`   Full Raw Payload:`);
      console.log(JSON.stringify(issue.rawPayload, null, 2));
      console.log('   ---\n');
    });

    // Event name distribution
    const eventNameDist = {};
    const statusDist = {};
    
    analysis.forEach(a => {
      const eventName = a.rawEventName || 'undefined';
      const status = a.dbStatus;
      
      eventNameDist[eventName] = (eventNameDist[eventName] || 0) + 1;
      statusDist[status] = (statusDist[status] || 0) + 1;
    });

    console.log('📈 EVENT NAME DISTRIBUTION:');
    Object.entries(eventNameDist).forEach(([name, count]) => {
      console.log(`   "${name}": ${count} events`);
    });

    console.log('\n📈 DATABASE STATUS DISTRIBUTION:');
    Object.entries(statusDist).forEach(([status, count]) => {
      console.log(`   "${status}": ${count} events`);
    });

    // Vendor-Channel breakdown
    const vcBreakdown = {};
    analysis.forEach(a => {
      const key = `${a.vendor}_${a.channel}`;
      if (!vcBreakdown[key]) {
        vcBreakdown[key] = {
          eventNames: {},
          statuses: {},
          total: 0
        };
      }
      
      const eventName = a.rawEventName || 'undefined';
      vcBreakdown[key].eventNames[eventName] = (vcBreakdown[key].eventNames[eventName] || 0) + 1;
      vcBreakdown[key].statuses[a.dbStatus] = (vcBreakdown[key].statuses[a.dbStatus] || 0) + 1;
      vcBreakdown[key].total++;
    });

    console.log('\n📊 VENDOR-CHANNEL BREAKDOWN:');
    Object.entries(vcBreakdown).forEach(([vc, data]) => {
      console.log(`\n   ${vc} (${data.total} events):`);
      console.log(`     Event Names: ${JSON.stringify(data.eventNames, null, 6)}`);
      console.log(`     DB Statuses: ${JSON.stringify(data.statuses, null, 6)}`);
    });

  } catch (error) {
    console.error('Error analyzing data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

function mapEventName(eventName) {
  if (!eventName) return 'sent';
  
  const map = {
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
  
  return map[eventName.toLowerCase()] || 'sent';
}

// Run the analysis
analyzeWebhookData();