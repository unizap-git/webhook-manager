import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Seed Vendors
  const vendors = [
    {
      name: 'MSG91',
      slug: 'msg91',
      description: 'MSG91 is a cloud communication platform for SMS, Email, and Voice APIs',
      isActive: true
    },
    {
      name: 'AiSensy',
      slug: 'aisensy',
      description: 'AiSensy provides WhatsApp Business API and omnichannel messaging solutions',
      isActive: true
    },
    {
      name: 'Sendgrid',
      slug: 'sendgrid',
      description: 'SendGrid is a cloud-based email delivery platform for transactional and marketing emails',
      isActive: true
    },
    {
      name: 'Karix',
      slug: 'karix',
      description: 'Karix is an enterprise communication platform for SMS, WhatsApp, and Voice APIs',
      isActive: true
    }
  ];

  console.log('📧 Creating vendors...');
  for (const vendorData of vendors) {
    const existingVendor = await prisma.vendor.findUnique({
      where: { slug: vendorData.slug }
    });

    if (!existingVendor) {
      const vendor = await prisma.vendor.create({
        data: vendorData
      });
      console.log(`✅ Created vendor: ${vendor.name}`);
    } else {
      console.log(`⏭️  Vendor ${vendorData.name} already exists`);
    }
  }

  // Seed Channels
  const channels = [
    {
      name: 'SMS',
      type: 'sms',
      description: 'Short Message Service for text messaging',
      isActive: true
    },
    {
      name: 'WhatsApp',
      type: 'whatsapp',
      description: 'WhatsApp Business messaging for rich media communication',
      isActive: true
    },
    {
      name: 'Email',
      type: 'email',
      description: 'Email messaging for transactional and marketing communications',
      isActive: true
    }
  ];

  console.log('📱 Creating channels...');
  for (const channelData of channels) {
    const existingChannel = await prisma.channel.findUnique({
      where: { name: channelData.name }
    });

    if (!existingChannel) {
      const channel = await prisma.channel.create({
        data: channelData
      });
      console.log(`✅ Created channel: ${channel.name}`);
    } else {
      console.log(`⏭️  Channel ${channelData.name} already exists`);
    }
  }

  // Display final counts
  const vendorCount = await prisma.vendor.count();
  const channelCount = await prisma.channel.count();
  
  console.log('');
  console.log('🎉 Seeding completed successfully!');
  console.log(`📊 Total vendors: ${vendorCount}`);
  console.log(`📊 Total channels: ${channelCount}`);
  console.log('');
  console.log('Available Vendors:');
  const allVendors = await prisma.vendor.findMany();
  allVendors.forEach(vendor => console.log(`  - ${vendor.name}: ${vendor.slug}`));
  
  console.log('');
  console.log('Available Channels:');
  const allChannels = await prisma.channel.findMany();
  allChannels.forEach(channel => console.log(`  - ${channel.name}: ${channel.type}`));
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });