import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import { env, isDevelopment } from './config/env';
import { config } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimit } from './middleware/rateLimiter';

// Routes
import authRoutes from './routes/auth';
import vendorRoutes from './routes/vendors';
import channelRoutes from './routes/channels';
import webhookRoutes from './routes/webhook';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/user';
import projectRoutes from './routes/projects';

// Services
import { initializeWorkers } from './workers';
import cronService from './services/cronService';
import { getRedisClient } from './config/redis';

const app = express();

// Rate limiting
app.use(globalRateLimit);

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for development
}));
app.use(compression());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const redisClient = await getRedisClient();
    const redisStatus = redisClient ? 'connected' : 'disconnected';
    
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env.NODE_ENV,
      redis: redisStatus,
      cronService: cronService.isRunning()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// Debug endpoint to check database
app.get('/debug/users', async (req, res) => {
  try {
    const { prisma } = await import('./config/database');
    const userCount = await prisma.user.count();
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, accountType: true }
    });
    res.json({ userCount, users });
  } catch (error) {
    res.status(500).json({ error: 'Database query failed', details: error });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/user', userRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    logger.info('🚀 Starting Communication Analytics Backend...');

    // Initialize Redis connection
    try {
      await getRedisClient();
      logger.info('✅ Redis connection established');
    } catch (error) {
      if (isDevelopment()) {
        logger.warn('⚠️  Redis unavailable - continuing without queue processing');
      } else {
        throw error;
      }
    }

    // Initialize background workers
    await initializeWorkers();
    logger.info('✅ Background workers initialized');
    
    // Start cron service - DISABLED for webhook testing
    // await cronService.start();
    // logger.info('✅ Cron service started');
    logger.info('⚠️ Cron service disabled for webhook testing');
    
    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`✅ Server running on port ${env.PORT}`);
      logger.info(`🌍 Environment: ${env.NODE_ENV}`);
      logger.info(`🔗 Frontend URL: ${env.CORS_ORIGIN}`);
      logger.info('🎉 Communication Analytics Backend is ready!');
    });

    // Graceful shutdown handling
    const gracefulShutdown = async () => {
      logger.info('📴 Shutting down gracefully...');
      
      // Close HTTP server
      server.close(() => {
        logger.info('✅ HTTP server closed');
      });

      // Stop cron service
      try {
        await cronService.stop();
        logger.info('✅ Cron service stopped');
      } catch (error) {
        logger.error('❌ Error stopping cron service:', error);
      }

      process.exit(0);
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();