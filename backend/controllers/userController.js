const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// JWT secret - in production, this should be an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Helper function to generate a random password
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Register new parent account
const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
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

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, accountType: user.accountType },
      JWT_SECRET,
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
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

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
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        accountType: user.accountType,
        parentId: user.parentId 
      },
      JWT_SECRET,
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
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create child account (only for parent accounts)
const createChildAccount = async (req, res) => {
  try {
    const { email, name } = req.body;
    const parentId = req.user.userId;

    // Verify that the requester is a parent account
    if (req.user.accountType !== 'PARENT') {
      return res.status(403).json({ error: 'Only parent accounts can create child accounts' });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
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
        parentId
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
    console.error('Create child account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get child accounts (only for parent accounts)
const getChildAccounts = async (req, res) => {
  try {
    const parentId = req.user.userId;

    // Verify that the requester is a parent account
    if (req.user.accountType !== 'PARENT') {
      return res.status(403).json({ error: 'Only parent accounts can view child accounts' });
    }

    // Get child accounts
    const childAccounts = await prisma.user.findMany({
      where: { parentId },
      select: {
        id: true,
        email: true,
        name: true,
        accountType: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      success: true,
      childAccounts
    });
  } catch (error) {
    console.error('Get child accounts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Reset child account password (only for parent accounts)
const resetChildPassword = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user.userId;

    // Verify that the requester is a parent account
    if (req.user.accountType !== 'PARENT') {
      return res.status(403).json({ error: 'Only parent accounts can reset child passwords' });
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
      return res.status(404).json({ error: 'Child account not found or not authorized' });
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
    console.error('Reset child password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete child account (only for parent accounts)
const deleteChildAccount = async (req, res) => {
  try {
    const { childId } = req.params;
    const parentId = req.user.userId;

    // Verify that the requester is a parent account
    if (req.user.accountType !== 'PARENT') {
      return res.status(403).json({ error: 'Only parent accounts can delete child accounts' });
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
      return res.status(404).json({ error: 'Child account not found or not authorized' });
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
    console.error('Delete child account error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  login,
  createChildAccount,
  getChildAccounts,
  resetChildPassword,
  deleteChildAccount
};