import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

export const getChannels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const channels = await prisma.channel.findMany({
      orderBy: { type: 'asc' },
    });

    res.json({
      channels,
    });
  } catch (error) {
    logger.error('Get channels error:', error);
    next(error);
  }
};