const express = require('express');
const {
  register,
  login,
  createChildAccount,
  getChildAccounts,
  resetChildPassword,
  deleteChildAccount
} = require('../controllers/userController');
const { authenticateToken, requireParentAccount } = require('../middleware/auth');

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes - require authentication
router.use(authenticateToken);

// Parent-only routes
router.post('/child-accounts', requireParentAccount, createChildAccount);
router.get('/child-accounts', requireParentAccount, getChildAccounts);
router.post('/child-accounts/:childId/reset-password', requireParentAccount, resetChildPassword);
router.delete('/child-accounts/:childId', requireParentAccount, deleteChildAccount);

module.exports = router;