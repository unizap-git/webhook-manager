import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma, config } from '../config/database';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    accountType: string;
    parentId?: string;
  };
}

export const getVendors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all global vendors
    const vendors = await prisma.vendor.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      vendors,
    });
  } catch (error) {
    logger.error('Get vendors error:', error);
    next(error);
  }
};

export const getChannels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all global channels
    const channels = await prisma.channel.findMany({
      where: {
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    res.json({
      channels,
    });
  } catch (error) {
    logger.error('Get channels error:', error);
    next(error);
  }
};

export const getUserVendorChannels = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { projectId } = req.query;

    let whereClause: any = { userId };
    
    if (projectId) {
      whereClause.projectId = projectId as string;
    }

    const configs = await prisma.userVendorChannel.findMany({
      where: whereClause,
      include: {
        vendor: true,
        channel: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { project: { name: 'asc' } },
        { vendor: { name: 'asc' } },
        { channel: { name: 'asc' } },
      ],
    });

    res.json({
      configs,
    });
  } catch (error) {
    logger.error('Get user vendor channels error:', error);
    next(error);
  }
};

export const addUserVendorChannel = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { vendorId, channelId, projectId, webhookSecret } = req.body;

    if (!projectId || !vendorId || !channelId) {
      res.status(400).json({
        error: 'projectId, vendorId, and channelId are required',
      });
      return;
    }

    // Verify user has access to the project
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { userId: userId! }, // User owns the project
          { 
            projectAccess: {
              some: {
                userId: userId!,
              },
            },
          }, // User has access to the project
        ],
      },
    });

    if (!project) {
      res.status(403).json({
        error: 'Access denied to this project',
      });
      return;
    }

    // Verify vendor and channel exist
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!vendor || !channel) {
      res.status(404).json({
        error: 'Vendor or channel not found',
      });
      return;
    }

    // Check if combination already exists
    const existing = await prisma.userVendorChannel.findFirst({
      where: {
        userId: userId!,
        vendorId: vendor.id,
        channelId: channel.id,
        projectId,
      },
    });

    if (existing) {
      res.status(409).json({
        error: 'This vendor-channel combination already exists in this project',
      });
      return;
    }

    // Generate unique webhook URL using project-based format
    const webhookToken = uuidv4();
    const webhookUrl = `${config.webhook.baseUrl}/api/webhook/${project.name}/${vendor.slug}/${channel.type}?token=${webhookToken}`;

    // Create user vendor channel mapping
    const userConfig = await prisma.userVendorChannel.create({
      data: {
        userId: userId!,
        vendorId: vendor.id,
        channelId: channel.id,
        projectId,
        webhookUrl,
        webhookSecret: webhookSecret || null, // Include webhook secret if provided
      },
      include: {
        vendor: true,
        channel: true,
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    logger.info(`New vendor-channel config created for user ${userId}: ${vendor.name} - ${channel.type} in project ${project.name}`);

    res.status(201).json({
      message: 'Vendor-channel configuration created successfully',
      config: userConfig,
    });
  } catch (error) {
    logger.error('Add user vendor channel error:', error);
    next(error);
  }
};

export const removeUserVendorChannel = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Check if config exists and belongs to user
    const config = await prisma.userVendorChannel.findFirst({
      where: {
        ...(id ? { id } : {}),
        userId: userId!,
      },
    });

    if (!config) {
      res.status(404).json({
        error: 'Configuration not found',
      });
      return;
    }

    // Delete the configuration
    await prisma.userVendorChannel.delete({
      where: { id: id! },
    });

    logger.info(`Vendor-channel config deleted for user ${userId}: ${id}`);

    res.json({
      message: 'Configuration removed successfully',
    });
  } catch (error) {
    logger.error('Remove user vendor channel error:', error);
    next(error);
  }
};