import { Router } from 'express';
import { getAnalytics, getDashboardStats } from '../controllers/analyticsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All analytics routes require authentication
router.use(authenticateToken);

// Routes
router.get('/dashboard', getDashboardStats);
router.get('/', getAnalytics);

export default router;