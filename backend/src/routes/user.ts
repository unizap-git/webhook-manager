import { Router } from 'express';
import { getUserProfile } from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All user routes require authentication
router.use(authenticateToken);

// Routes
router.get('/profile', getUserProfile);

export default router;