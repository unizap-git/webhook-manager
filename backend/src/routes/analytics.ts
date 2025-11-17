import { Router } from 'express';
import { 
  getAnalytics, 
  getDashboardStats, 
  getEventAnalytics, 
  getDebugEventData,
  getVendorChannelAnalytics,
  getChannelAnalytics,
  getFailureAnalytics
} from '../controllers/analyticsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All analytics routes require authentication
router.use(authenticateToken);

// Routes
router.get('/dashboard', getDashboardStats);
router.get('/events', getEventAnalytics);
router.get('/vendor-channel', getVendorChannelAnalytics);
router.get('/channels', getChannelAnalytics);
router.get('/failures', getFailureAnalytics);
router.get('/debug', getDebugEventData);
router.get('/', getAnalytics);

export default router;