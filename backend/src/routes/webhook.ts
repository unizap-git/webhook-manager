import { Router } from 'express';
import { receiveWebhook } from '../controllers/webhookController';

const router = Router();

// Webhook endpoint - no authentication required as this is called by external services
router.post('/:userId/:vendor/:channel', receiveWebhook);

export default router;