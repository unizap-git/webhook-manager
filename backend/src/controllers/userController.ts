import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
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

// Helper function to generate a random password
const generateRandomPassword = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export const getUserProfile = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const accountType = req.user?.accountType;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        accountType: true,
        createdAt: true,
        updatedAt: true,
        parent: {
          select: { id: true, email: true, name: true }
        }
      },
    });

    if (!user) {
      res.status(404).json({
        error: 'User not found',
      });
      return;
    }

    // Get total message count
    const totalMessages = await prisma.message.count({
      where: { userId },
    });

    // Get active configurations count
    const activeConfigurations = await prisma.userVendorChannel.count({
      where: { userId, isActive: true },
    });

    // Get projects count
    const projectsCount = await prisma.project.count({
      where: { userId },
    });

    // Get child accounts count (for parents only)
    let childAccountsCount = 0;
    let childAccounts: any[] = [];
    if (accountType === 'PARENT') {
      childAccountsCount = await prisma.user.count({
        where: { parentId: userId },
      });

      childAccounts = await prisma.user.findMany({
        where: { parentId: userId },
        select: {
          id: true,
          name: true,
          email: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              projectAccess: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
    }

    // Get message events to calculate success rate
    const messageEvents = await prisma.messageEvent.findMany({
      where: { message: { userId } },
      select: {
        messageId: true,
        status: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'desc' },
    });

    // Group by messageId to get latest status
    const latestStatusByMessage = new Map<string, string>();
    messageEvents.forEach(event => {
      if (!latestStatusByMessage.has(event.messageId)) {
        latestStatusByMessage.set(event.messageId, event.status);
      }
    });

    // Calculate success rate
    let deliveredCount = 0;
    let readCount = 0;
    latestStatusByMessage.forEach(status => {
      if (status === 'delivered') deliveredCount++;
      if (status === 'read') readCount++;
    });

    const successRate = totalMessages > 0
      ? ((deliveredCount + readCount) / totalMessages * 100)
      : 0;

    // Get usage trends (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const messagesLast30Days = await prisma.message.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      select: {
        createdAt: true,
      },
    });

    // Group by date
    const dailyMessageMap = new Map<string, number>();
    messagesLast30Days.forEach(msg => {
      const dateKey = msg.createdAt.toISOString().split('T')[0] || '';
      if (dateKey) {
        dailyMessageMap.set(dateKey, (dailyMessageMap.get(dateKey) || 0) + 1);
      }
    });

    const usageTrends = Array.from(dailyMessageMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate average daily messages
    const avgDailyMessages = messagesLast30Days.length > 0
      ? Math.round(messagesLast30Days.length / 30)
      : 0;

    // Get recent activity (last 15 messages)
    const recentMessages = await prisma.message.findMany({
      where: { userId },
      select: {
        id: true,
        recipient: true,
        vendorId: true,
        channelId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    });

    // Get message events for recent messages
    const recentMessageIds = recentMessages.map(m => m.id);
    const recentEvents = await prisma.messageEvent.findMany({
      where: { messageId: { in: recentMessageIds } },
      select: {
        messageId: true,
        status: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'desc' },
    });

    // Get latest event for each message
    const latestEventMap = new Map<string, { status: string; timestamp: Date }>();
    recentEvents.forEach(event => {
      if (!latestEventMap.has(event.messageId)) {
        latestEventMap.set(event.messageId, {
          status: event.status,
          timestamp: event.timestamp,
        });
      }
    });

    // Get vendor and channel names
    const vendorIdsForRecent = [...new Set(recentMessages.map(m => m.vendorId))];
    const channelIdsForRecent = [...new Set(recentMessages.map(m => m.channelId))];

    const vendorsForRecent = await prisma.vendor.findMany({
      where: { id: { in: vendorIdsForRecent } },
    });

    const channelsForRecent = await prisma.channel.findMany({
      where: { id: { in: channelIdsForRecent } },
    });

    const recentActivity = recentMessages.map(msg => {
      const event = latestEventMap.get(msg.id);
      const vendor = vendorsForRecent.find(v => v.id === msg.vendorId);
      const channel = channelsForRecent.find(c => c.id === msg.channelId);

      return {
        id: msg.id,
        recipient: msg.recipient,
        vendor: vendor?.name || 'Unknown',
        channel: channel?.name || 'Unknown',
        status: event?.status || 'sent',
        timestamp: event?.timestamp || msg.createdAt,
      };
    });

    // Get projects list
    const projects = await prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
        _count: {
          select: {
            userVendorChannels: true,
            messages: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Get top vendors used
    const vendorUsage = await prisma.message.groupBy({
      by: ['vendorId'],
      where: { userId },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    const vendorIds = vendorUsage.map(v => v.vendorId);
    const vendors = await prisma.vendor.findMany({
      where: { id: { in: vendorIds } },
    });

    const topVendors = vendorUsage.map(usage => {
      const vendor = vendors.find(v => v.id === usage.vendorId);
      return {
        vendorId: usage.vendorId,
        vendorName: vendor?.name || 'Unknown',
        messageCount: usage._count.id,
      };
    });

    res.json({
      user,
      stats: {
        totalMessages,
        activeConfigurations,
        projectsCount,
        childAccountsCount,
        successRate: Math.round(successRate * 100) / 100,
        avgDailyMessages,
      },
      usageTrends,
      recentActivity,
      projects,
      topVendors,
      childAccounts: accountType === 'PARENT' ? childAccounts : undefined,
    });
  } catch (error) {
    logger.error('Get user profile error:', error);
    next(error);
  }
};

// Register new parent account
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists with this email' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        accountType: 'PARENT'
      }
    });

    // Create default project for new user
    await prisma.project.create({
      data: {
        name: 'Default Project',
        description: 'Your first project to get started',
        userId: user.id,
      }
    });

    logger.info(`👤 New user registered: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, accountType: user.accountType },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType
      }
    });
  } catch (error) {
    logger.error('Register error:', error);
    next(error);
  }
};

// Login
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Login endpoint

    // Validate request body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        parent: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn(`Login failed - invalid password for email: ${email}`);
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    logger.info(`Login successful for email: ${email}`);

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        accountType: user.accountType,
        parentId: user.parentId 
      },
      config.jwt.secret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        parent: user.parent
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

// Create child account (only for parent accounts)
export const createChildAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, name } = req.body;
    const parentId = req.user?.userId;

    // Verify that the requester is a parent account
    if (req.user?.accountType !== 'PARENT') {
      res.status(403).json({ error: 'Only parent accounts can create child accounts' });
      return;
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(400).json({ error: 'User already exists with this email' });
      return;
    }

    // Generate random password
    const randomPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(randomPassword, 12);

    // Create child account
    const childAccount = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        accountType: 'CHILD',
        parentId: parentId || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Child account created successfully',
      childAccount: {
        id: childAccount.id,
        email: childAccount.email,
        name: childAccount.name,
        accountType: childAccount.accountType,
        password: randomPassword, // Send the plain password back once
        createdAt: childAccount.createdAt
      }
    });
  } catch (error) {
    logger.error('Create child account error:', error);
    next(error);
  }
};

// Get child accounts (only for parent accounts)
export const getChildAccounts = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parentId = req.user?.userId;

    // Verify that the requester is a parent account
    if (req.user?.accountType !== 'PARENT') {
      res.status(403).json({ error: 'Only parent accounts can view child accounts' });
      return;
    }

    // Get child accounts with project access information
    const childAccounts = await prisma.user.findMany({
      where: {
        ...(parentId ? { parentId } : {})
      },
      select: {
        id: true,
        email: true,
        name: true,
        accountType: true,
        createdAt: true,
        projectAccess: {
          select: {
            projectId: true,
            accessType: true,
            project: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      childAccounts
    });
  } catch (error) {
    logger.error('Get child accounts error:', error);
    next(error);
  }
};

// Reset child account password (only for parent accounts)
export const resetChildPassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.userId;

    if (!childId) {
      res.status(400).json({ error: 'Child ID is required' });
      return;
    }

    if (!parentId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Verify that the requester is a parent account
    if (req.user?.accountType !== 'PARENT') {
      res.status(403).json({ error: 'Only parent accounts can reset child passwords' });
      return;
    }

    // Verify that the child account belongs to this parent
    const childAccount = await prisma.user.findFirst({
      where: {
        id: childId,
        parentId: parentId,
        accountType: 'CHILD'
      }
    });

    if (!childAccount) {
      res.status(404).json({ error: 'Child account not found or not authorized' });
      return;
    }

    // Generate new random password
    const newPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update child account password
    await prisma.user.update({
      where: { id: childId },
      data: { password: hashedPassword }
    });

    res.json({
      success: true,
      message: 'Child account password reset successfully',
      newPassword // Send the new password back once
    });
  } catch (error) {
    logger.error('Reset child password error:', error);
    next(error);
  }
};

// Delete child account (only for parent accounts)
export const deleteChildAccount = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { childId } = req.params;
    const parentId = req.user?.userId;

    if (!childId) {
      res.status(400).json({ error: 'Child ID is required' });
      return;
    }

    if (!parentId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Verify that the requester is a parent account
    if (req.user?.accountType !== 'PARENT') {
      res.status(403).json({ error: 'Only parent accounts can delete child accounts' });
      return;
    }

    // Verify that the child account belongs to this parent
    const childAccount = await prisma.user.findFirst({
      where: {
        id: childId,
        parentId: parentId,
        accountType: 'CHILD'
      }
    });

    if (!childAccount) {
      res.status(404).json({ error: 'Child account not found or not authorized' });
      return;
    }

    // Delete child account
    await prisma.user.delete({
      where: { id: childId }
    });

    res.json({
      success: true,
      message: 'Child account deleted successfully'
    });
  } catch (error) {
    logger.error('Delete child account error:', error);
    next(error);
  }
};

// Change password
export const changePassword = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Current password and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      res.status(400).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    logger.info(`🔒 Password changed for user: ${userId}`);

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    next(error);
  }
};