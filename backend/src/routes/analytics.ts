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
import {
  dashboardCache,
  vendorChannelCache,
  channelsCache,
  failuresCache
} from '../middleware/analyticsCache';

const router = Router();

// All analytics routes require authentication and effective user ID
router.use(authenticateToken);
router.use(getEffectiveUserId);

// Routes with caching middleware
router.get('/dashboard', dashboardCache, getDashboardStats);
router.get('/vendor-channel', vendorChannelCache, getVendorChannelAnalytics);
router.get('/channels', channelsCache, getChannelAnalytics);
router.get('/failures', failuresCache, getFailureAnalytics);

// Routes without caching
router.get('/events', getEventAnalytics);
router.get('/projects', getProjectAnalytics);
router.get('/debug', getDebugEventData);
router.get('/', getAnalytics);

export default router;