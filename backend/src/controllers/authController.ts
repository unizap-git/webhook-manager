import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { logger } from '../utils/logger';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    accountType: string;
    parentId?: string;
  };
}

// Helper function to generate tokens
const generateTokens = (userId: string, email: string, accountType: string, parentId?: string) => {
  const accessToken = jwt.sign(
    { userId, email, accountType, parentId },
    env.JWT_ACCESS_SECRET || 'default-secret',
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN || '1h' } as jwt.SignOptions
  );
  
  const refreshToken = jwt.sign(
    { userId, email, accountType, parentId },
    env.JWT_REFRESH_SECRET || 'default-refresh-secret',
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
  
  return { accessToken, refreshToken };
};

export const signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(409).json({
        error: 'User already exists with this email',
      });
      return;
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        parentId: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.accountType, user.parentId || undefined);

    logger.info(`New user registered: ${email}`);

    res.status(201).json({
      message: 'User created successfully',
      user,
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Signup error:', error);
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors.array(),
      });
      return;
    }

    const { email, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user.id, user.email, user.accountType, user.parentId || undefined);

    logger.info(`User logged in: ${email}`);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      res.status(401).json({
        error: 'Refresh token required',
      });
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET || 'default-refresh-secret') as {
      userId: string;
      email: string;
    };

    // Check if user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
    });

    if (!user) {
      res.status(401).json({
        error: 'User not found',
      });
      return;
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user.id,
      user.email,
      user.accountType,
      user.parentId || undefined
    );

    res.json({
      tokens: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid refresh token',
      });
      return;
    }
    
    next(error);
  }
};

export const logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // In a more sophisticated implementation, you would maintain a blacklist
    // of revoked tokens or store refresh tokens in the database
    
    logger.info(`User logged out: ${req.user?.email}`);
    
    res.json({
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    next(error);
  }
};