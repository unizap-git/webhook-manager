import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';
import { logger } from '../utils/logger';

// Create libSQL client for Turso
const libsqlConfig: any = {
  url: process.env.TURSO_DATABASE_URL || 'file:./dev.db',
};

// Only add authToken if it exists (required for remote Turso, not for local file)
if (process.env.TURSO_AUTH_TOKEN) {
  libsqlConfig.authToken = process.env.TURSO_AUTH_TOKEN;
}

const libsql = createClient(libsqlConfig);

// Create Prisma adapter
const adapter = new PrismaLibSQL(libsql);

// Create Prisma client with libSQL adapter
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
} as any);

export const config = {
  database: {
    url: process.env.TURSO_DATABASE_URL || 'file:./dev.db',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  webhook: {
    baseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:3000',
  },
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
};

// Test database connection
export async function connectDatabase() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully to Turso');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}

// Graceful shutdown
export async function disconnectDatabase() {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
