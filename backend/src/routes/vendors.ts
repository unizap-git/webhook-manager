import { Router } from 'express';
import { getVendors, getUserVendorChannels, addUserVendorChannel, removeUserVendorChannel } from '../controllers/vendorController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All vendor routes require authentication
router.use(authenticateToken);

// Routes
router.get('/', getVendors);
router.get('/user-configs', getUserVendorChannels);
router.post('/user-configs', addUserVendorChannel);
router.delete('/user-configs/:id', removeUserVendorChannel);

export default router;