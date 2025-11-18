import { Router } from 'express';
import { 
  getAnalytics, 
  getDashboardStats, 
  getEventAnalytics, 
  getDebugEventData,
  getVendorChannelAnalytics,
  getChannelAnalytics,
  getFailureAnalytics,
  getProjectAnalytics
} from '../controllers/analyticsController';
import { authenticateToken, getEffectiveUserId } from '../middleware/auth';

const router = Router();

// All analytics routes require authentication and effective user ID
router.use(authenticateToken);
router.use(getEffectiveUserId);

// Routes
router.get('/dashboard', getDashboardStats);
router.get('/events', getEventAnalytics);
router.get('/vendor-channel', getVendorChannelAnalytics);
router.get('/channels', getChannelAnalytics);
router.get('/failures', getFailureAnalytics);
router.get('/projects', getProjectAnalytics);
router.get('/debug', getDebugEventData);
router.get('/', getAnalytics);

export default router;