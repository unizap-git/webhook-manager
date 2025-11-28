import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';

import { env, isDevelopment } from './config/env';
import { config } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimit } from './middleware/rateLimiter';
import { swaggerSpec } from './config/swagger';

// Routes
import authRoutes from './routes/auth';
import vendorRoutes from './routes/vendors';
import channelRoutes from './routes/channels';
import webhookRoutes from './routes/webhook';
import analyticsRoutes from './routes/analytics';
import userRoutes from './routes/user';
import projectRoutes from './routes/projects';
import outboundRoutes from './routes/outbound';

// Services
import { initializeWorkers } from './workers';
import cronService from './services/cronService';
import { getRedisClient, isRedisAvailable } from './config/redis';

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

// Swagger API Documentation
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none }
    .swagger-ui .info .title { color: #8c47e2 }
    .swagger-ui .opblock.opblock-post .opblock-summary-method { background: #8c47e2 }
    .swagger-ui .opblock.opblock-post { border-color: #8c47e2; background: rgba(140, 71, 226, 0.1) }
    .swagger-ui .btn.authorize { background-color: #8c47e2; border-color: #8c47e2; color: white }
    .swagger-ui .btn.authorize svg { fill: white }
    .swagger-ui .auth-btn-wrapper .btn-done { background-color: #8c47e2; color: white }
  `,
  customSiteTitle: 'WebHook Hub API Docs',
  customfavIcon: '/favicon.svg',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    docExpansion: 'none',
    defaultModelsExpandDepth: 2,
    defaultModelExpandDepth: 2,
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

// Serve raw OpenAPI JSON spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const redisStatus = isRedisAvailable() ? 'connected' : 'disconnected';

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
app.use('/api/outbound', outboundRoutes);

// 404 handler for undefined routes
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Initialize services and start server
async function startServer() {
  try {
    // Clean startup banner
    logger.info('');
    logger.info('🚀 Communication Analytics Backend');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Initialize Redis connection (optional)
    try {
      const redis = await getRedisClient();
      if (redis) {
        logger.info('✅ Redis connected');
      } else {
        logger.warn('⚠️  Redis unavailable - using fallback mode');
      }
    } catch (error) {
      logger.warn('⚠️  Redis connection failed - using fallback mode');
    }

    // Initialize background workers
    await initializeWorkers();
    logger.info('✅ Workers initialized');
    
    // Start cron service - DISABLED for webhook testing
    // await cronService.start();
    logger.info('⚠️  Cron service disabled');
    
    // Start HTTP server
    const server = app.listen(env.PORT, () => {
      logger.info(`🌐 Server: http://localhost:${env.PORT}`);
      logger.info(`📚 API Docs: http://localhost:${env.PORT}/api-docs`);
      logger.info(`🔗 Frontend: ${env.CORS_ORIGIN}`);
      logger.info(`📦 Environment: ${env.NODE_ENV}`);
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('🎉 Ready for connections!');
      logger.info('');
    });

    // Graceful shutdown handling
    const gracefulShutdown = async () => {
      logger.info('');
      logger.info('📴 Shutting down...');
      
      // Close HTTP server
      server.close(() => {
        logger.info('✅ Server stopped');
      });

      // Stop cron service
      try {
        await cronService.stop();
      } catch (error) {
        // Silent error handling
      }

      logger.info('👋 Goodbye!');
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