import { Router } from 'express';
import { getChannels } from '../controllers/channelController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All channel routes require authentication
router.use(authenticateToken);

// Routes
router.get('/', getChannels);

export default router;