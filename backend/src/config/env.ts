import { config } from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';

// Load environment variables
config();

// Environment variables schema for validation
const envSchema = z.object({
  // Server configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform((val: string) => parseInt(val, 10)),
  
  // Database configuration
  DATABASE_URL: z.string().default('file:./dev.db'),
  
  // JWT configuration
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT access secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  
  // Redis configuration
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().default('6379').transform((val: string) => parseInt(val, 10)),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().default('0').transform((val: string) => parseInt(val, 10)),
  
  // Vendor API Keys
  SENDGRID_API_KEY: z.string().optional(),
  KARIX_API_KEY: z.string().optional(),
  KARIX_API_SECRET: z.string().optional(),
  AISENSY_API_KEY: z.string().optional(),
  MSG91_AUTH_KEY: z.string().optional(),
  
  // Security configuration
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform((val: string) => parseInt(val, 10)), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform((val: string) => parseInt(val, 10)),
  
  // Analytics configuration
  ANALYTICS_AGGREGATION_INTERVAL: z.string().default('0 0 * * * *'), // Every hour
  ANALYTICS_CLEANUP_DAYS: z.string().default('30').transform((val: string) => parseInt(val, 10)),
  
  // Logging configuration
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // CORS configuration
  CORS_ORIGIN: z.string().default('http://localhost:5173').transform((val: string) => 
    val.split(',').map(url => url.trim())
  ),
  
  // Queue configuration
  QUEUE_CONCURRENCY: z.string().default('5').transform((val: string) => parseInt(val, 10)),
  QUEUE_MAX_RETRIES: z.string().default('3').transform((val: string) => parseInt(val, 10)),
});

// Validate environment variables
const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  logger.error('❌ Invalid environment variables:');
  parseResult.error.issues.forEach((issue: any) => {
    logger.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  });
  process.exit(1);
}

export const env = parseResult.data;

// Type-safe environment configuration
export interface EnvConfig {
  // Server
  NODE_ENV: 'development' | 'production' | 'test';
  PORT: number;
  
  // Database
  DATABASE_URL: string;
  
  // JWT
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  
  // Redis
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;
  REDIS_DB: number;
  
  // Vendor API Keys
  SENDGRID_API_KEY?: string;
  KARIX_API_KEY?: string;
  KARIX_API_SECRET?: string;
  AISENSY_API_KEY?: string;
  MSG91_AUTH_KEY?: string;
  
  // Security
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  
  // Analytics
  ANALYTICS_AGGREGATION_INTERVAL: string;
  ANALYTICS_CLEANUP_DAYS: number;
  
  // Logging
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug';
  
  // CORS
  CORS_ORIGIN: string[];
  
  // Queue
  QUEUE_CONCURRENCY: number;
  QUEUE_MAX_RETRIES: number;
}

// Helper functions
export const isDevelopment = () => env.NODE_ENV === 'development';
export const isProduction = () => env.NODE_ENV === 'production';
export const isTest = () => env.NODE_ENV === 'test';

// Database URL helper
export const getDatabaseUrl = (): string => {
  if (isTest()) {
    return 'file:./test.db';
  }
  return env.DATABASE_URL;
};

// Redis configuration helper
export const getRedisConfig = () => ({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD,
  db: env.REDIS_DB,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

// Vendor API configuration
export const getVendorConfig = (vendor: string) => {
  switch (vendor.toLowerCase()) {
    case 'sendgrid':
      return { apiKey: env.SENDGRID_API_KEY };
    case 'karix':
      return { apiKey: env.KARIX_API_KEY, apiSecret: env.KARIX_API_SECRET };
    case 'aisensy':
      return { apiKey: env.AISENSY_API_KEY };
    case 'msg91':
      return { authKey: env.MSG91_AUTH_KEY };
    default:
      return {};
  }
};

// Export the validated environment
export default env;