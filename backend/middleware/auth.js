const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// JWT secret - in production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verify JWT token middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Get user from database to ensure they still exist
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

    // Add user info to request
    req.user = {
      userId: user.id,
      email: user.email,
      accountType: user.accountType,
      parentId: user.parentId,
      name: user.name
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Middleware to ensure only parent accounts can access certain routes
const requireParentAccount = (req, res, next) => {
  if (req.user.accountType !== 'PARENT') {
    return res.status(403).json({ error: 'This action requires a parent account' });
  }
  next();
};

// Middleware to ensure only child accounts can access certain routes
const requireChildAccount = (req, res, next) => {
  if (req.user.accountType !== 'CHILD') {
    return res.status(403).json({ error: 'This action requires a child account' });
  }
  next();
};

// Middleware to get the effective user ID (parent for child accounts, self for parent accounts)
// This is useful for analytics where child accounts should see parent's data
const getEffectiveUserId = (req, res, next) => {
  if (req.user.accountType === 'CHILD') {
    req.effectiveUserId = req.user.parentId;
  } else {
    req.effectiveUserId = req.user.userId;
  }
  next();
};

module.exports = {
  authenticateToken,
  requireParentAccount,
  requireChildAccount,
  getEffectiveUserId
};