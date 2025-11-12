import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { prisma, config } from '../config/database';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const getVendors = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendors = await prisma.vendor.findMany({
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

export const getUserVendorChannels = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const configs = await prisma.userVendorChannel.findMany({
      where: { userId },
      include: {
        vendor: true,
        channel: true,
      },
      orderBy: [
        { vendor: { name: 'asc' } },
        { channel: { type: 'asc' } },
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

export const addUserVendorChannel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { vendorId, channelId } = req.body;

    if (!vendorId || !channelId) {
      return res.status(400).json({
        error: 'vendorId and channelId are required',
      });
    }

    // Check if combination already exists
    const existing = await prisma.userVendorChannel.findUnique({
      where: {
        userId_vendorId_channelId: {
          userId: userId!,
          vendorId,
          channelId,
        },
      },
    });

    if (existing) {
      return res.status(409).json({
        error: 'This vendor-channel combination already exists',
      });
    }

    // Get vendor and channel info for webhook URL generation
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
    });

    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!vendor || !channel) {
      return res.status(404).json({
        error: 'Vendor or channel not found',
      });
    }

    // Generate unique webhook URL
    const webhookToken = uuidv4();
    const webhookUrl = `${config.webhook.baseUrl}/api/webhook/${userId}/${vendor.slug}/${channel.type}?token=${webhookToken}`;

    // Create user vendor channel mapping
    const userConfig = await prisma.userVendorChannel.create({
      data: {
        userId: userId!,
        vendorId,
        channelId,
        webhookUrl,
      },
      include: {
        vendor: true,
        channel: true,
      },
    });

    logger.info(`New vendor-channel config created for user ${userId}: ${vendor.name} - ${channel.type}`);

    res.status(201).json({
      message: 'Vendor-channel configuration created successfully',
      config: userConfig,
    });
  } catch (error) {
    logger.error('Add user vendor channel error:', error);
    next(error);
  }
};

export const removeUserVendorChannel = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // Check if config exists and belongs to user
    const config = await prisma.userVendorChannel.findFirst({
      where: {
        id,
        userId: userId!,
      },
    });

    if (!config) {
      return res.status(404).json({
        error: 'Configuration not found',
      });
    }

    // Delete the configuration
    await prisma.userVendorChannel.delete({
      where: { id },
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