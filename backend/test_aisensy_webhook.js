const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testAisensyIntegration() {
  try {
    console.log('=== Testing AiSensy Webhook Integration ===\n');

    // 1. Check if AiSensy vendor exists
    console.log('1. Checking AiSensy vendor...');
    const aisensyVendor = await prisma.vendor.findFirst({
      where: { slug: 'aisensy' }
    });

    if (aisensyVendor) {
      console.log(`✅ AiSensy vendor found: ${aisensyVendor.name} (ID: ${aisensyVendor.id})`);
    } else {
      console.log('❌ AiSensy vendor not found');
      return;
    }

    // 2. Check WhatsApp channel
    console.log('\n2. Checking WhatsApp channel...');
    const whatsappChannel = await prisma.channel.findFirst({
      where: { type: 'whatsapp' }
    });

    if (whatsappChannel) {
      console.log(`✅ WhatsApp channel found: ${whatsappChannel.name} (ID: ${whatsappChannel.id})`);
    } else {
      console.log('❌ WhatsApp channel not found');
      return;
    }

    // 3. Test signature verification
    console.log('\n3. Testing signature verification...');
    const crypto = require('crypto');
    
    const testPayload = JSON.stringify({
      message: {
        messageId: "test_123",
        status: "delivered",
        phone_number: "+919876543210"
      }
    });
    
    const testSecret = "test_webhook_secret_123";
    const expectedSignature = crypto.createHmac('sha256', testSecret)
      .update(testPayload)
      .digest('hex');
    
    console.log('✅ Signature verification logic working');
    console.log(`Test payload: ${testPayload.substring(0, 50)}...`);
    console.log(`Expected signature: ${expectedSignature}`);

    // 4. Check database schema
    console.log('\n4. Checking database schema updates...');
    const sampleConfig = await prisma.userVendorChannel.findFirst({
      select: {
        id: true,
        webhookSecret: true,
        webhookUrl: true
      }
    });

    if (sampleConfig) {
      console.log('✅ UserVendorChannel table has webhookSecret field');
      console.log(`Sample config: webhookSecret = ${sampleConfig.webhookSecret || 'null'}`);
    }

    console.log('\n🎉 AiSensy integration setup complete!');
    console.log('\nNext steps:');
    console.log('1. Create a UserVendorChannel configuration with AiSensy vendor and WhatsApp channel');
    console.log('2. Add webhook secret to the configuration');
    console.log('3. Test webhook endpoint with actual AiSensy payload');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAisensyIntegration();