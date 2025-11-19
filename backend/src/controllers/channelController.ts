import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export const getChannels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query;
    
    let channels;
    if (projectId) {
      // Get channels used in a specific project via UserVendorChannel
      channels = await prisma.channel.findMany({
        where: {
          userVendorChannels: {
            some: {
              project: {
                id: projectId as string,
              },
            },
          },
        },
        orderBy: { type: 'asc' },
      });
    } else {
      // Get all available channel types (for creating new channels)
      channels = await prisma.channel.findMany({
        select: {
          type: true,
          name: true,
        },
        distinct: ['type'],
        orderBy: { type: 'asc' },
      });
    }

    res.json({
      channels,
    });
  } catch (error) {
    logger.error('Get channels error:', error);
    next(error);
  }
};