import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * User authentication schemas
 */
export const authSchemas = {
  register: z.object({
    body: z.object({
      email: z.string().email('Invalid email format').min(1, 'Email is required'),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
          'Password must contain uppercase, lowercase, number and special character'),
      name: z.string().min(2, 'Name must be at least 2 characters').max(50, 'Name too long')
    })
  }),

  login: z.object({
    body: z.object({
      email: z.string().email('Invalid email format').min(1, 'Email is required'),
      password: z.string().min(1, 'Password is required')
    })
  }),

  refreshToken: z.object({
    body: z.object({
      refreshToken: z.string().min(1, 'Refresh token is required')
    })
  }),

  changePassword: z.object({
    body: z.object({
      currentPassword: z.string().min(1, 'Current password is required'),
      newPassword: z.string()
        .min(8, 'New password must be at least 8 characters')
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
          'Password must contain uppercase, lowercase, number and special character')
    })
  }),

  resetPassword: z.object({
    body: z.object({
      email: z.string().email('Invalid email format').min(1, 'Email is required')
    })
  })
};

/**
 * Webhook schemas
 */
export const webhookSchemas = {
  // Generic webhook params
  webhookParams: z.object({
    params: z.object({
      userId: z.string().uuid('Invalid user ID format'),
      vendor: z.enum(['sendgrid', 'karix', 'aisensy', 'msg91'], {
        message: 'Invalid vendor. Must be one of: sendgrid, karix, aisensy, msg91'
      }),
      channel: z.enum(['email', 'whatsapp', 'sms'], {
        message: 'Invalid channel. Must be one of: email, whatsapp, sms'
      })
    })
  }),

  // SendGrid webhook payload
  sendgridPayload: z.object({
    body: z.array(z.object({
      email: z.string().email(),
      timestamp: z.number(),
      event: z.enum(['processed', 'delivered', 'deferred', 'bounce', 'dropped', 'open', 'click', 'spamreport', 'unsubscribe', 'group_unsubscribe', 'group_resubscribe']),
      'sg_message_id': z.string().optional(),
      'smtp-id': z.string().optional(),
      reason: z.string().optional(),
      status: z.string().optional(),
      response: z.string().optional(),
      url: z.string().url().optional(),
      useragent: z.string().optional(),
      ip: z.string().optional()
    }))
  }),

  // Karix webhook payload
  karixPayload: z.object({
    body: z.object({
      account_uid: z.string(),
      message_uid: z.string(),
      to: z.string(),
      from: z.string(),
      channel: z.enum(['sms', 'whatsapp']),
      status: z.enum(['queued', 'sent', 'delivered', 'read', 'failed', 'rejected']),
      direction: z.enum(['inbound', 'outbound']),
      total_cost: z.string().optional(),
      created_time: z.string().datetime(),
      sent_time: z.string().datetime().optional(),
      delivered_time: z.string().datetime().optional(),
      failed_time: z.string().datetime().optional(),
      error_code: z.string().optional(),
      error_message: z.string().optional()
    })
  }),

  // AiSensy webhook payload  
  aisensyPayload: z.object({
    body: z.object({
      messageId: z.string(),
      to: z.string(),
      status: z.enum(['sent', 'delivered', 'read', 'failed']),
      timestamp: z.string().datetime(),
      errorCode: z.string().optional(),
      errorMessage: z.string().optional(),
      channel: z.literal('whatsapp')
    })
  }),

  // MSG91 webhook payload
  msg91Payload: z.object({
    body: z.object({
      request_id: z.string(),
      mobile: z.string(),
      status: z.enum(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']), // MSG91 status codes
      desc: z.string(),
      type: z.enum(['sms', 'otp']),
      sent_time: z.string(),
      delivered_time: z.string().optional(),
      campaign: z.string().optional(),
      cost: z.string().optional()
    })
  })
};

/**
 * Analytics schemas
 */
export const analyticsSchemas = {
  dashboardQuery: z.object({
    query: z.object({
      period: z.enum(['1d', '7d', '30d', '90d']).optional().default('7d'),
      vendorId: z.string().uuid().optional(),
      channelId: z.string().uuid().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional()
    })
  }),

  analyticsQuery: z.object({
    query: z.object({
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      vendorId: z.string().uuid().optional(),
      channelId: z.string().uuid().optional(),
      groupBy: z.enum(['hour', 'day', 'week', 'month']).optional(),
      limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 100).pipe(z.number().min(1).max(1000)),
      offset: z.string().optional().transform((val) => val ? parseInt(val, 10) : 0).pipe(z.number().min(0))
    })
  })
};

/**
 * User vendor channel schemas
 */
export const userVendorChannelSchemas = {
  create: z.object({
    body: z.object({
      vendorId: z.string().uuid('Invalid vendor ID'),
      channelId: z.string().uuid('Invalid channel ID'),
      apiKey: z.string().min(1, 'API key is required').max(500, 'API key too long'),
      apiSecret: z.string().max(500, 'API secret too long').optional(),
      isActive: z.boolean().optional().default(true)
    })
  }),

  update: z.object({
    params: z.object({
      id: z.string().uuid('Invalid user vendor channel ID')
    }),
    body: z.object({
      apiKey: z.string().min(1, 'API key is required').max(500, 'API key too long').optional(),
      apiSecret: z.string().max(500, 'API secret too long').optional(),
      isActive: z.boolean().optional()
    })
  }),

  delete: z.object({
    params: z.object({
      id: z.string().uuid('Invalid user vendor channel ID')
    })
  })
};

/**
 * Common parameter schemas
 */
export const commonSchemas = {
  uuidParam: z.object({
    params: z.object({
      id: z.string().uuid('Invalid ID format')
    })
  }),

  paginationQuery: z.object({
    query: z.object({
      page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1).pipe(z.number().min(1)),
      limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10).pipe(z.number().min(1).max(100)),
      sortBy: z.string().optional(),
      sortOrder: z.enum(['asc', 'desc']).optional()
    })
  })
};

/**
 * Middleware factory for Zod validation
 */
export const validate = (schema: z.ZodSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate the request
      const validationData = {
        body: req.body,
        query: req.query,
        params: req.params
      };

      const result = await schema.parseAsync(validationData);
      
      // Replace req data with validated data
      req.body = result.body || req.body;
      req.query = result.query || req.query;
      req.params = result.params || req.params;

      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorDetails = error.issues.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
          received: err.received
        }));

        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: errorDetails,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Handle other validation errors
      logger.error('Validation processing failed:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Validation processing failed',
        timestamp: new Date().toISOString()
      });
    }
  };
};

/**
 * Specific validation middlewares for common use cases
 */
export const validationMiddleware = {
  // Auth validations
  validateRegister: validate(authSchemas.register),
  validateLogin: validate(authSchemas.login),
  validateRefreshToken: validate(authSchemas.refreshToken),
  validateChangePassword: validate(authSchemas.changePassword),
  validateResetPassword: validate(authSchemas.resetPassword),

  // Webhook validations
  validateWebhookParams: validate(webhookSchemas.webhookParams),
  validateSendGridWebhook: validate(webhookSchemas.sendgridPayload),
  validateKarixWebhook: validate(webhookSchemas.karixPayload),
  validateAiSensyWebhook: validate(webhookSchemas.aisensyPayload),
  validateMsg91Webhook: validate(webhookSchemas.msg91Payload),

  // Analytics validations
  validateDashboardQuery: validate(analyticsSchemas.dashboardQuery),
  validateAnalyticsQuery: validate(analyticsSchemas.analyticsQuery),

  // User vendor channel validations
  validateCreateUserVendorChannel: validate(userVendorChannelSchemas.create),
  validateUpdateUserVendorChannel: validate(userVendorChannelSchemas.update),
  validateDeleteUserVendorChannel: validate(userVendorChannelSchemas.delete),

  // Common validations
  validateUuidParam: validate(commonSchemas.uuidParam),
  validatePagination: validate(commonSchemas.paginationQuery)
};

/**
 * Dynamic webhook validation based on vendor
 */
export const validateWebhookPayload = (req: Request, res: Response, next: NextFunction) => {
  const vendor = req.params.vendor?.toLowerCase();
  
  let payloadValidator;
  switch (vendor) {
    case 'sendgrid':
      payloadValidator = validationMiddleware.validateSendGridWebhook;
      break;
    case 'karix':
      payloadValidator = validationMiddleware.validateKarixWebhook;
      break;
    case 'aisensy':
      payloadValidator = validationMiddleware.validateAiSensyWebhook;
      break;
    case 'msg91':
      payloadValidator = validationMiddleware.validateMsg91Webhook;
      break;
    default:
      return res.status(400).json({
        error: 'Invalid vendor',
        message: `Unsupported vendor: ${vendor}`,
        timestamp: new Date().toISOString()
      });
  }

  return payloadValidator(req, res, next);
};

export default {
  authSchemas,
  webhookSchemas,
  analyticsSchemas,
  userVendorChannelSchemas,
  commonSchemas,
  validate,
  validationMiddleware,
  validateWebhookPayload
};