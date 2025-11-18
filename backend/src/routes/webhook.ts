import { Router } from 'express';
import { receiveWebhook } from '../controllers/webhookController';

const router = Router();

// Webhook endpoint - no authentication required as this is called by external services
// New format: /webhook/{project}/{vendor}/{channel}
router.post('/:project/:vendor/:channel', receiveWebhook);

export default router;