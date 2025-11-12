import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const getUserProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        error: 'User not found',
      });
    }

    // Get user statistics
    const stats = await prisma.message.aggregate({
      where: { userId },
      _count: {
        id: true,
      },
    });

    const vendorChannelCount = await prisma.userVendorChannel.count({
      where: { userId },
    });

    res.json({
      user,
      stats: {
        totalMessages: stats._count.id,
        activeConfigurations: vendorChannelCount,
      },
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    next(error);
  }
};