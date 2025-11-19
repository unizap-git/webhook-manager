import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

async function main() {
  // Create vendors
  const vendors = [
    { name: 'Msg91', slug: 'msg91' },
    { name: 'Karix', slug: 'karix' },
    { name: 'AiSensy', slug: 'aisensy' },
    { name: 'SendGrid', slug: 'sendgrid' },
  ];

  for (const vendor of vendors) {
    await prisma.vendor.upsert({
      where: { slug: vendor.slug },
      update: {},
      create: vendor,
    });
  }

  // Create channels
  const channels = [
    { type: 'sms', name: 'SMS' },
    { type: 'whatsapp', name: 'WhatsApp' },
    { type: 'email', name: 'Email' },
  ];

  for (const channel of channels) {
    await prisma.channel.upsert({
      where: { type: channel.type },
      update: {},
      create: channel,
    });
  }

  logger.info('🌱 Database seeded successfully!');
}

main()
  .catch((e) => {
    logger.error('Database seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });