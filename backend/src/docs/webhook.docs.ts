/**
 * @swagger
 * /api/webhook/{project}/{vendor}/{channel}:
 *   post:
 *     summary: Receive webhook callback from vendor
 *     description: |
 *       Endpoint for receiving webhook callbacks from messaging vendors.
 *
 *       **How it works:**
 *       1. Configure this URL in your vendor's webhook settings
 *       2. Vendor sends delivery status updates to this endpoint
 *       3. We parse and store the event data
 *       4. Analytics are updated in real-time
 *
 *       **URL Format:**
 *       ```
 *       POST /api/webhook/{project-slug}/{vendor-slug}/{channel-type}
 *       ```
 *
 *       **Example URLs:**
 *       - `POST /api/webhook/ecommerce/msg91/sms`
 *       - `POST /api/webhook/mobile-app/sendgrid/email`
 *       - `POST /api/webhook/crm/msg91/whatsapp`
 *
 *       **Supported Vendors:**
 *       - **msg91**: SMS, WhatsApp
 *       - **sendgrid**: Email
 *       - **karix**: SMS
 *       - **aisensy**: WhatsApp
 *
 *       **Rate Limiting:** 1000 requests per minute per IP
 *     tags: [Webhooks]
 *     security: []
 *     parameters:
 *       - name: project
 *         in: path
 *         required: true
 *         description: Project slug (URL-friendly project name)
 *         schema:
 *           type: string
 *         examples:
 *           ecommerce:
 *             summary: E-commerce project
 *             value: ecommerce
 *           mobileApp:
 *             summary: Mobile app project
 *             value: mobile-app
 *       - name: vendor
 *         in: path
 *         required: true
 *         description: Vendor slug
 *         schema:
 *           type: string
 *           enum: [msg91, sendgrid, karix, aisensy]
 *         examples:
 *           msg91:
 *             summary: MSG91
 *             value: msg91
 *           sendgrid:
 *             summary: SendGrid
 *             value: sendgrid
 *       - name: channel
 *         in: path
 *         required: true
 *         description: Channel type
 *         schema:
 *           type: string
 *           enum: [sms, whatsapp, email]
 *         examples:
 *           sms:
 *             summary: SMS channel
 *             value: sms
 *           email:
 *             summary: Email channel
 *             value: email
 *           whatsapp:
 *             summary: WhatsApp channel
 *             value: whatsapp
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/WebhookPayloadMSG91'
 *               - $ref: '#/components/schemas/WebhookPayloadSendGrid'
 *           examples:
 *             msg91_sms_delivered:
 *               summary: MSG91 SMS - Delivered
 *               description: Example of MSG91 SMS delivery webhook
 *               value:
 *                 data:
 *                   - requestId: "347424e75077306b3673"
 *                     userId: "250494"
 *                     report:
 *                       - date: "2024-01-15 17:35:00"
 *                         number: "919999999999"
 *                         status: "DELIVERED"
 *                         desc: "Message delivered to handset"
 *             msg91_sms_failed:
 *               summary: MSG91 SMS - Failed
 *               description: Example of MSG91 SMS failure webhook
 *               value:
 *                 data:
 *                   - requestId: "347424e75077306b3674"
 *                     userId: "250494"
 *                     report:
 *                       - date: "2024-01-15 17:36:00"
 *                         number: "919999999998"
 *                         status: "FAILED"
 *                         desc: "Invalid phone number"
 *             msg91_whatsapp_delivered:
 *               summary: MSG91 WhatsApp - Delivered
 *               description: Example of MSG91 WhatsApp delivery webhook
 *               value:
 *                 event: "message-delivered"
 *                 to: "919999999999"
 *                 messageId: "wamid.abc123xyz"
 *                 timestamp: "2024-01-15T17:35:00Z"
 *             msg91_whatsapp_read:
 *               summary: MSG91 WhatsApp - Read
 *               description: Example of MSG91 WhatsApp read receipt
 *               value:
 *                 event: "message-read"
 *                 to: "919999999999"
 *                 messageId: "wamid.abc123xyz"
 *                 timestamp: "2024-01-15T17:40:00Z"
 *             sendgrid_delivered:
 *               summary: SendGrid Email - Delivered
 *               description: Example of SendGrid email delivery webhook
 *               value:
 *                 - email: "user@example.com"
 *                   timestamp: 1705337700
 *                   event: "delivered"
 *                   sg_message_id: "14c5d75ce93.dfd.64b469"
 *                   response: "250 OK"
 *             sendgrid_opened:
 *               summary: SendGrid Email - Opened
 *               description: Example of SendGrid email open event
 *               value:
 *                 - email: "user@example.com"
 *                   timestamp: 1705338000
 *                   event: "open"
 *                   sg_message_id: "14c5d75ce93.dfd.64b469"
 *                   useragent: "Mozilla/5.0"
 *                   ip: "1.2.3.4"
 *             sendgrid_bounced:
 *               summary: SendGrid Email - Bounced
 *               description: Example of SendGrid email bounce
 *               value:
 *                 - email: "invalid@example.com"
 *                   timestamp: 1705337800
 *                   event: "bounce"
 *                   sg_message_id: "14c5d75ce93.dfd.64b470"
 *                   reason: "550 User unknown"
 *                   type: "bounce"
 *             karix_sms_delivered:
 *               summary: Karix SMS - Delivered
 *               description: Example of Karix SMS delivery webhook
 *               value:
 *                 messageId: "karix-msg-123"
 *                 to: "+919999999999"
 *                 status: "DELIVRD"
 *                 timestamp: "2024-01-15T17:35:00Z"
 *                 errorCode: null
 *             karix_sms_failed:
 *               summary: Karix SMS - Failed
 *               description: Example of Karix SMS failure webhook
 *               value:
 *                 messageId: "karix-msg-124"
 *                 to: "+919999999998"
 *                 status: "FAILED"
 *                 timestamp: "2024-01-15T17:36:00Z"
 *                 errorCode: "EC_INVALID_NUMBER"
 *                 errorMessage: "Invalid mobile number"
 *             aisensy_whatsapp_delivered:
 *               summary: Aisensy WhatsApp - Delivered
 *               description: Example of Aisensy WhatsApp delivery webhook
 *               value:
 *                 eventType: "message_delivered"
 *                 phoneNumber: "919999999999"
 *                 messageId: "aisensy-msg-123"
 *                 timestamp: "2024-01-15T17:35:00.000Z"
 *             aisensy_whatsapp_read:
 *               summary: Aisensy WhatsApp - Read
 *               description: Example of Aisensy WhatsApp read receipt
 *               value:
 *                 eventType: "message_read"
 *                 phoneNumber: "919999999999"
 *                 messageId: "aisensy-msg-123"
 *                 timestamp: "2024-01-15T17:40:00.000Z"
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WebhookResponse'
 *             examples:
 *               success:
 *                 summary: Successful processing
 *                 value:
 *                   success: true
 *                   message: Webhook processed successfully
 *                   eventsProcessed: 5
 *               partialSuccess:
 *                 summary: Partial success
 *                 value:
 *                   success: true
 *                   message: Webhook processed with some errors
 *                   eventsProcessed: 3
 *                   errors: 2
 *       400:
 *         description: Invalid webhook payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalidPayload:
 *                 summary: Invalid payload format
 *                 value:
 *                   error: Invalid webhook payload
 *                   details: Missing required field 'status'
 *               unknownVendor:
 *                 summary: Unknown vendor
 *                 value:
 *                   error: Unknown vendor
 *                   details: "Vendor 'unknown' is not supported"
 *       404:
 *         description: Webhook configuration not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Webhook configuration not found
 *               details: No active configuration for project/vendor/channel combination
 *       429:
 *         $ref: '#/components/responses/RateLimitError'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Internal server error
 *               details: Failed to process webhook
 */

export {};
