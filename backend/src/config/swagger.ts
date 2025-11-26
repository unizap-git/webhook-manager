import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WebHook Hub API',
      version: '1.0.0',
      description: `
## WebHook Hub - Unified Webhook Management Platform

WebHook Hub is a comprehensive SaaS platform for managing webhooks across multiple vendors and channels.

### Features
- **Multi-vendor Support**: MSG91, SendGrid, Karix, Aisensy
- **Multi-channel Support**: SMS, WhatsApp, Email
- **Real-time Analytics**: Track message delivery, read rates, and failures
- **Project Management**: Organize webhooks by projects
- **Child Accounts**: Create sub-accounts with limited access
- **Caching**: Redis-based caching for optimal performance

### Authentication
All protected endpoints require a **Bearer JWT token** in the Authorization header:
\`\`\`
Authorization: Bearer <your_jwt_token>
\`\`\`

### Rate Limiting
- **Global**: 100 requests per 15 minutes per IP
- **Auth endpoints**: 5 requests per 15 minutes per IP
- **Webhook endpoints**: 1000 requests per minute per IP

### Error Handling
All errors follow a consistent format:
\`\`\`json
{
  "error": "Error message",
  "details": "Additional details (optional)"
}
\`\`\`
      `,
      contact: {
        name: 'WebHook Hub Support',
        email: 'support@webhookhub.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: env.NODE_ENV === 'production'
          ? 'https://webhook-manager-be.onrender.com'
          : `http://localhost:${env.PORT}`,
        description: env.NODE_ENV === 'production' ? 'Production Server' : 'Development Server',
      },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and session management',
      },
      {
        name: 'User',
        description: 'User profile and account management',
      },
      {
        name: 'Child Accounts',
        description: 'Manage child/sub-accounts (Parent accounts only)',
      },
      {
        name: 'Projects',
        description: 'Project management and organization',
      },
      {
        name: 'Project Access',
        description: 'Manage project access for child accounts',
      },
      {
        name: 'Vendors',
        description: 'Vendor and channel configuration',
      },
      {
        name: 'Analytics',
        description: 'Message analytics and reporting',
      },
      {
        name: 'Webhooks',
        description: 'Webhook endpoints for receiving vendor callbacks',
      },
      {
        name: 'System',
        description: 'Health checks and system information',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT token obtained from login',
        },
      },
      schemas: {
        // ==================== Error Responses ====================
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
              example: 'Something went wrong',
            },
            details: {
              type: 'string',
              description: 'Additional error details',
              example: 'Invalid input provided',
            },
          },
          required: ['error'],
        },
        ValidationError: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              example: 'Validation failed',
            },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'email' },
                  message: { type: 'string', example: 'Please provide a valid email' },
                },
              },
            },
          },
        },

        // ==================== Auth Schemas ====================
        SignupRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              minLength: 2,
              maxLength: 50,
              example: 'John Doe',
              description: 'User full name (2-50 characters)',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
              description: 'Valid email address',
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'Password123',
              description: 'Password (min 6 chars, must contain uppercase, lowercase, and number)',
            },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
            },
            password: {
              type: 'string',
              example: 'Password123',
            },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Login successful',
            },
            token: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'JWT access token (expires in 24h)',
            },
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
              description: 'Refresh token (expires in 7d)',
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
        },
        RefreshTokenRequest: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },

        // ==================== User Schemas ====================
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clx1234567890',
            },
            name: {
              type: 'string',
              example: 'John Doe',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
            },
            accountType: {
              type: 'string',
              enum: ['PARENT', 'CHILD'],
              example: 'PARENT',
              description: 'PARENT accounts can create child accounts',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-15T10:30:00Z',
            },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            user: {
              $ref: '#/components/schemas/User',
            },
            stats: {
              type: 'object',
              properties: {
                totalMessages: { type: 'integer', example: 1845 },
                activeConfigurations: { type: 'integer', example: 5 },
                projectsCount: { type: 'integer', example: 3 },
                childAccountsCount: { type: 'integer', example: 2 },
                successRate: { type: 'number', example: 94.5 },
                avgDailyMessages: { type: 'number', example: 263.57 },
              },
            },
            usageTrends: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', example: '2024-01-15' },
                  count: { type: 'integer', example: 250 },
                },
              },
            },
            recentActivity: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  recipient: { type: 'string', example: '+1234567890' },
                  vendor: { type: 'string', example: 'MSG91' },
                  channel: { type: 'string', example: 'SMS' },
                  status: { type: 'string', example: 'delivered' },
                  timestamp: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        ChangePasswordRequest: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: {
              type: 'string',
              example: 'OldPassword123',
            },
            newPassword: {
              type: 'string',
              minLength: 6,
              example: 'NewPassword456',
              description: 'Min 6 characters',
            },
          },
        },

        // ==================== Child Account Schemas ====================
        CreateChildAccountRequest: {
          type: 'object',
          required: ['name', 'email', 'password'],
          properties: {
            name: {
              type: 'string',
              example: 'Child User',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'child@example.com',
            },
            password: {
              type: 'string',
              minLength: 6,
              example: 'ChildPass123',
            },
          },
        },
        ChildAccount: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890' },
            name: { type: 'string', example: 'Child User' },
            email: { type: 'string', example: 'child@example.com' },
            accountType: { type: 'string', example: 'CHILD' },
            createdAt: { type: 'string', format: 'date-time' },
            projectAccess: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  projectId: { type: 'string' },
                  projectName: { type: 'string' },
                  accessType: { type: 'string', enum: ['specific', 'all'] },
                },
              },
            },
          },
        },

        // ==================== Project Schemas ====================
        Project: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              example: 'clx1234567890',
            },
            name: {
              type: 'string',
              example: 'E-commerce Platform',
            },
            description: {
              type: 'string',
              example: 'Webhook configurations for our e-commerce platform',
            },
            userId: {
              type: 'string',
              description: 'Owner user ID',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
            _count: {
              type: 'object',
              properties: {
                messages: { type: 'integer', example: 1500 },
                userVendorChannels: { type: 'integer', example: 3 },
              },
            },
          },
        },
        CreateProjectRequest: {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
              example: 'My New Project',
              description: 'Project name (must be unique per user)',
            },
            description: {
              type: 'string',
              example: 'Description of my project',
            },
          },
        },
        UpdateProjectRequest: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Updated Project Name',
            },
            description: {
              type: 'string',
              example: 'Updated description',
            },
          },
        },
        GrantAccessRequest: {
          type: 'object',
          required: ['childUserId', 'projectId'],
          properties: {
            childUserId: {
              type: 'string',
              example: 'clx1234567890',
              description: 'ID of the child account',
            },
            projectId: {
              type: 'string',
              example: 'clx0987654321',
              description: 'ID of the project to grant access to',
            },
            accessType: {
              type: 'string',
              enum: ['specific', 'all'],
              default: 'specific',
              description: 'Type of access to grant',
            },
          },
        },
        BatchGrantAccessRequest: {
          type: 'object',
          required: ['childUserId', 'projectIds'],
          properties: {
            childUserId: {
              type: 'string',
              example: 'clx1234567890',
            },
            projectIds: {
              type: 'array',
              items: { type: 'string' },
              example: ['clx111', 'clx222', 'clx333'],
              description: 'Array of project IDs to grant access to',
            },
          },
        },

        // ==================== Vendor Schemas ====================
        Vendor: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890' },
            name: { type: 'string', example: 'MSG91' },
            slug: { type: 'string', example: 'msg91' },
            description: { type: 'string', example: 'SMS and WhatsApp provider' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Channel: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890' },
            name: { type: 'string', example: 'SMS' },
            type: { type: 'string', example: 'sms', enum: ['sms', 'whatsapp', 'email'] },
            description: { type: 'string', example: 'Short Message Service' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        UserVendorChannel: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'clx1234567890' },
            userId: { type: 'string' },
            vendorId: { type: 'string' },
            channelId: { type: 'string' },
            projectId: { type: 'string' },
            webhookUrl: {
              type: 'string',
              example: 'https://webhook-manager-be.onrender.com/api/webhook/myproject/msg91/sms',
              description: 'Generated webhook URL to configure in vendor dashboard',
            },
            webhookSecret: {
              type: 'string',
              example: 'whsec_abc123...',
              description: 'Secret for webhook signature verification',
            },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            vendor: { $ref: '#/components/schemas/Vendor' },
            channel: { $ref: '#/components/schemas/Channel' },
            project: { $ref: '#/components/schemas/Project' },
          },
        },
        CreateUserVendorChannelRequest: {
          type: 'object',
          required: ['vendorId', 'channelId', 'projectId'],
          properties: {
            vendorId: {
              type: 'string',
              example: 'clx1234567890',
              description: 'ID of the vendor',
            },
            channelId: {
              type: 'string',
              example: 'clx0987654321',
              description: 'ID of the channel',
            },
            projectId: {
              type: 'string',
              example: 'clxabcdef123',
              description: 'ID of the project',
            },
          },
        },

        // ==================== Analytics Schemas ====================
        DashboardStats: {
          type: 'object',
          properties: {
            summary: {
              type: 'object',
              properties: {
                totalMessages: { type: 'integer', example: 1845 },
                totalSent: { type: 'integer', example: 1800 },
                totalDelivered: { type: 'integer', example: 1650 },
                totalRead: { type: 'integer', example: 1200 },
                totalFailed: { type: 'integer', example: 45 },
                deliveryRate: { type: 'number', example: 91.67 },
                readRate: { type: 'number', example: 66.67 },
                failureRate: { type: 'number', example: 2.5 },
              },
            },
            dailyStats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string', example: '2024-01-15' },
                  totalMessages: { type: 'integer', example: 250 },
                  totalSent: { type: 'integer', example: 245 },
                  totalDelivered: { type: 'integer', example: 230 },
                  totalRead: { type: 'integer', example: 180 },
                  totalFailed: { type: 'integer', example: 5 },
                  successRate: { type: 'number', example: 98.0 },
                },
              },
            },
            vendorStats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  vendorId: { type: 'string' },
                  vendorName: { type: 'string', example: 'MSG91' },
                  totalMessages: { type: 'integer', example: 1200 },
                  successRate: { type: 'number', example: 95.5 },
                },
              },
            },
            period: { type: 'string', example: '7d' },
          },
        },
        VendorChannelAnalytics: {
          type: 'object',
          properties: {
            vendorChannelStats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  vendor: { type: 'string', example: 'MSG91' },
                  channel: { type: 'string', example: 'sms' },
                  totalMessages: { type: 'integer', example: 1425 },
                  sent: { type: 'integer', example: 1400 },
                  delivered: { type: 'integer', example: 1194 },
                  read: { type: 'integer', example: 0 },
                  failed: { type: 'integer', example: 231 },
                  deliveryRate: { type: 'number', example: 83.8 },
                  successRate: { type: 'number', example: 83.8 },
                  failureReasons: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        reason: { type: 'string', example: 'Invalid number' },
                        count: { type: 'integer', example: 150 },
                      },
                    },
                  },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                totalVendorChannelCombinations: { type: 'integer', example: 3 },
                totalMessages: { type: 'integer', example: 1845 },
                eventsProcessed: { type: 'integer', example: 5000 },
                limitReached: { type: 'boolean', example: false },
              },
            },
            period: { type: 'string', example: '7d' },
            dateRange: {
              type: 'object',
              properties: {
                startDate: { type: 'string', format: 'date-time' },
                endDate: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        FailureAnalytics: {
          type: 'object',
          properties: {
            failureStats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  reason: { type: 'string', example: 'Invalid phone number' },
                  count: { type: 'integer', example: 150 },
                  percentage: { type: 'number', example: 33.3 },
                  vendors: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['MSG91', 'Karix'],
                  },
                },
              },
            },
            summary: {
              type: 'object',
              properties: {
                totalFailures: { type: 'integer', example: 450 },
                uniqueReasons: { type: 'integer', example: 8 },
              },
            },
          },
        },

        // ==================== Webhook Schemas ====================
        WebhookPayloadMSG91: {
          type: 'object',
          description: 'MSG91 webhook payload example',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  requestId: { type: 'string', example: '347424e75077306b3673' },
                  userId: { type: 'string', example: '250494' },
                  report: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        date: { type: 'string', example: '2021-04-05 17:35:00' },
                        number: { type: 'string', example: '919999999999' },
                        status: { type: 'string', example: 'DELIVERED' },
                        desc: { type: 'string', example: 'Message delivered successfully' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        WebhookPayloadSendGrid: {
          type: 'object',
          description: 'SendGrid webhook payload example',
          properties: {
            email: { type: 'string', example: 'user@example.com' },
            timestamp: { type: 'integer', example: 1704067200 },
            event: { type: 'string', example: 'delivered', enum: ['processed', 'delivered', 'open', 'click', 'bounce', 'dropped', 'deferred'] },
            sg_message_id: { type: 'string', example: '14c5d75ce93.dfd.64b469.filter0001.16648.5515E0B88.0' },
            reason: { type: 'string', example: '' },
            status: { type: 'string', example: '250 OK' },
          },
        },
        WebhookResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Webhook processed successfully' },
            eventsProcessed: { type: 'integer', example: 5 },
          },
        },

        // ==================== System Schemas ====================
        HealthCheck: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', example: 3600.5, description: 'Server uptime in seconds' },
            environment: { type: 'string', example: 'production' },
            redis: { type: 'string', example: 'connected', enum: ['connected', 'disconnected'] },
            cronService: { type: 'boolean', example: true },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Access token is missing or invalid',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Unauthorized',
                details: 'Invalid or expired token',
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Access denied - insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Forbidden',
                details: 'Parent account required for this operation',
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Not found',
                details: 'The requested resource does not exist',
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationError',
              },
            },
          },
        },
        RateLimitError: {
          description: 'Too many requests',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                error: 'Too many requests',
                details: 'Rate limit exceeded. Please try again later.',
              },
            },
          },
        },
      },
      parameters: {
        PeriodParam: {
          name: 'period',
          in: 'query',
          description: 'Time period for analytics',
          schema: {
            type: 'string',
            enum: ['24h', '7d', '30d', '90d'],
            default: '7d',
          },
        },
        ProjectIdParam: {
          name: 'projectId',
          in: 'query',
          description: 'Filter by project ID (use "all" for all projects)',
          schema: {
            type: 'string',
          },
        },
        VendorIdParam: {
          name: 'vendorId',
          in: 'query',
          description: 'Filter by vendor ID',
          schema: {
            type: 'string',
          },
        },
        ChannelIdParam: {
          name: 'channelId',
          in: 'query',
          description: 'Filter by channel ID',
          schema: {
            type: 'string',
          },
        },
        NoCacheParam: {
          name: 'nocache',
          in: 'query',
          description: 'Bypass cache and fetch fresh data',
          schema: {
            type: 'boolean',
            default: false,
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/docs/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
