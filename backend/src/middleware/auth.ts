import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/database';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';

interface JwtPayload {
  userId: string;
  email: string;
  accountType: string;
  parentId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      effectiveUserId?: string;
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
      });
    }

    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    
    // Get user from database to ensure they still exist and get latest info
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        accountType: true,
        parentId: true,
        name: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = {
      userId: user.id,
      email: user.email,
      accountType: user.accountType,
      parentId: user.parentId
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Invalid token format',
      });
    }
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expired',
      });
    }
    
    return res.status(500).json({
      error: 'Token verification failed',
    });
  }
};

export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Ignore auth errors for optional auth
    next();
  }
};

// Middleware to ensure only parent accounts can access certain routes
export const requireParentAccount = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.accountType !== 'PARENT') {
    return res.status(403).json({ error: 'This action requires a parent account' });
  }
  next();
};

// Middleware to ensure only child accounts can access certain routes
export const requireChildAccount = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.accountType !== 'CHILD') {
    return res.status(403).json({ error: 'This action requires a child account' });
  }
  next();
};

// Middleware to get the effective user ID (parent for child accounts, self for parent accounts)
// This is useful for analytics where child accounts should see parent's data
export const getEffectiveUserId = (req: Request, res: Response, next: NextFunction) => {
  if (req.user?.accountType === 'CHILD') {
    req.effectiveUserId = req.user.parentId;
  } else {
    req.effectiveUserId = req.user?.userId;
  }
  next();
};