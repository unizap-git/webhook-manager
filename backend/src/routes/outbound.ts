import { Router } from 'express';
import {
  logOutboundMessage,
  batchLogOutboundMessages,
  getOutboundMessages,
  getMessageLifecycle,
  deleteOutboundMessage,
  backfillVendorRefIds,
  getBackfillStatus,
} from '../controllers/outboundController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all outbound routes
router.use(authenticateToken);

/**
 * @swagger
 * /api/outbound:
 *   post:
 *     summary: Log an outbound message
 *     description: Log a message that was sent via a vendor API. This allows matching with incoming webhook events.
 *     tags: [Outbound Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - vendorId
 *               - channelId
 *               - vendorRefId
 *               - recipient
 *               - content
 *             properties:
 *               projectId:
 *                 type: string
 *                 description: Project ID
 *               vendorId:
 *                 type: string
 *                 description: Vendor ID (MSG91, SendGrid, etc.)
 *               channelId:
 *                 type: string
 *                 description: Channel ID (SMS, Email, WhatsApp)
 *               vendorRefId:
 *                 type: string
 *                 description: The reference ID returned by the vendor (requestId, sg_message_id, etc.)
 *               recipient:
 *                 type: string
 *                 description: Recipient phone number or email
 *               content:
 *                 type: string
 *                 description: Original message content
 *               sentAt:
 *                 type: string
 *                 format: date-time
 *                 description: When the message was sent (defaults to now)
 *     responses:
 *       201:
 *         description: Message logged successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project, vendor, or channel not found
 */
router.post('/', logOutboundMessage);

/**
 * @swagger
 * /api/outbound/batch:
 *   post:
 *     summary: Batch log multiple outbound messages
 *     description: Log multiple outbound messages in a single request (max 100)
 *     tags: [Outbound Messages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - projectId
 *                     - vendorId
 *                     - channelId
 *                     - vendorRefId
 *                     - recipient
 *                     - content
 *                   properties:
 *                     projectId:
 *                       type: string
 *                     vendorId:
 *                       type: string
 *                     channelId:
 *                       type: string
 *                     vendorRefId:
 *                       type: string
 *                     recipient:
 *                       type: string
 *                     content:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *     responses:
 *       200:
 *         description: Batch processing complete
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 */
router.post('/batch', batchLogOutboundMessages);

/**
 * @swagger
 * /api/outbound:
 *   get:
 *     summary: Get outbound messages
 *     description: Retrieve logged outbound messages with optional filters
 *     tags: [Outbound Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *         description: Filter by project ID
 *       - in: query
 *         name: vendorId
 *         schema:
 *           type: string
 *         description: Filter by vendor ID
 *       - in: query
 *         name: channelId
 *         schema:
 *           type: string
 *         description: Filter by channel ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter to date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of outbound messages
 *       401:
 *         description: Unauthorized
 */
router.get('/', getOutboundMessages);

// Admin routes - MUST come BEFORE parameterized routes
/**
 * @swagger
 * /api/outbound/admin/backfill-status:
 *   get:
 *     summary: Get backfill status
 *     description: Check how many message events have vendor_ref_id populated
 *     tags: [Outbound Messages - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backfill status
 *       401:
 *         description: Unauthorized
 */
router.get('/admin/backfill-status', getBackfillStatus);

/**
 * @swagger
 * /api/outbound/admin/backfill:
 *   post:
 *     summary: Run vendor_ref_id backfill
 *     description: Backfill vendor_ref_id from raw_payload for existing events. Requires PARENT account.
 *     tags: [Outbound Messages - Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Backfill complete
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires PARENT account
 */
router.post('/admin/backfill', backfillVendorRefIds);

// Parameterized routes - MUST come AFTER static routes
/**
 * @swagger
 * /api/outbound/{vendorRefId}/lifecycle:
 *   get:
 *     summary: Get message lifecycle
 *     description: Get complete lifecycle of a message including outbound log and all webhook events
 *     tags: [Outbound Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: vendorRefId
 *         required: true
 *         schema:
 *           type: string
 *         description: The vendor reference ID (requestId, sg_message_id, etc.)
 *     responses:
 *       200:
 *         description: Message lifecycle data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     vendorRefId:
 *                       type: string
 *                     outboundMessage:
 *                       type: object
 *                       description: Original outbound message (if logged)
 *                     webhookEvents:
 *                       type: array
 *                       description: All webhook events for this message
 *                     timeline:
 *                       type: array
 *                       description: Chronological timeline of all events
 *                     currentStatus:
 *                       type: string
 *                       description: Current message status
 *       400:
 *         description: vendorRefId required
 *       401:
 *         description: Unauthorized
 */
router.get('/:vendorRefId/lifecycle', getMessageLifecycle);

/**
 * @swagger
 * /api/outbound/{id}:
 *   delete:
 *     summary: Delete an outbound message
 *     description: Delete a logged outbound message
 *     tags: [Outbound Messages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Outbound message ID
 *     responses:
 *       200:
 *         description: Message deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message not found
 */
router.delete('/:id', deleteOutboundMessage);

export default router;
