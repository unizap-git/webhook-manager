import { Router } from 'express';
import {
  getUserProfile,
  register,
  login,
  createChildAccount,
  getChildAccounts,
  resetChildPassword,
  deleteChildAccount,
  changePassword
} from '../controllers/userController';
import { authenticateToken, requireParentAccount } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes - require authentication
router.use(authenticateToken);

// User profile route
router.get('/profile', getUserProfile);
router.post('/change-password', changePassword);

// Parent-only routes
router.post('/child-accounts', requireParentAccount, createChildAccount);
router.get('/child-accounts', requireParentAccount, getChildAccounts);
router.post('/child-accounts/:childId/reset-password', requireParentAccount, resetChildPassword);
router.delete('/child-accounts/:childId', requireParentAccount, deleteChildAccount);

export default router;