/**
 * @swagger
 * /api/vendors:
 *   get:
 *     summary: Get all available vendors
 *     description: |
 *       Retrieve list of all supported webhook vendors.
 *
 *       **Supported Vendors:**
 *       - **MSG91**: SMS and WhatsApp messaging
 *       - **SendGrid**: Email delivery
 *       - **Karix**: SMS messaging
 *       - **Aisensy**: WhatsApp Business API
 *     tags: [Vendors]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Vendors retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 vendors:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Vendor'
 *             example:
 *               vendors:
 *                 - id: clxvendor1
 *                   name: MSG91
 *                   slug: msg91
 *                   description: SMS and WhatsApp messaging platform
 *                   isActive: true
 *                   createdAt: "2024-01-01T00:00:00Z"
 *                 - id: clxvendor2
 *                   name: SendGrid
 *                   slug: sendgrid
 *                   description: Email delivery platform
 *                   isActive: true
 *                   createdAt: "2024-01-01T00:00:00Z"
 *                 - id: clxvendor3
 *                   name: Karix
 *                   slug: karix
 *                   description: SMS messaging platform
 *                   isActive: true
 *                   createdAt: "2024-01-01T00:00:00Z"
 *                 - id: clxvendor4
 *                   name: Aisensy
 *                   slug: aisensy
 *                   description: WhatsApp Business API
 *                   isActive: true
 *                   createdAt: "2024-01-01T00:00:00Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/vendors/channels:
 *   get:
 *     summary: Get all available channels
 *     description: |
 *       Retrieve list of all supported communication channels.
 *
 *       **Supported Channels:**
 *       - **SMS**: Short Message Service
 *       - **WhatsApp**: WhatsApp messaging
 *       - **Email**: Email communication
 *     tags: [Vendors]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Channels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *             example:
 *               channels:
 *                 - id: clxchannel1
 *                   name: SMS
 *                   type: sms
 *                   description: Short Message Service
 *                   isActive: true
 *                 - id: clxchannel2
 *                   name: WhatsApp
 *                   type: whatsapp
 *                   description: WhatsApp messaging
 *                   isActive: true
 *                 - id: clxchannel3
 *                   name: Email
 *                   type: email
 *                   description: Email communication
 *                   isActive: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/vendors/user-configs:
 *   get:
 *     summary: Get user's webhook configurations
 *     description: |
 *       Retrieve all webhook configurations created by the current user.
 *       Each configuration represents a unique vendor-channel-project combination
 *       with a generated webhook URL.
 *     tags: [Vendors]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Configurations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 configs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserVendorChannel'
 *             example:
 *               configs:
 *                 - id: clxconfig1
 *                   userId: clxuser1
 *                   vendorId: clxvendor1
 *                   channelId: clxchannel1
 *                   projectId: clxproj1
 *                   webhookUrl: "https://webhook-manager-be.onrender.com/api/webhook/ecommerce/msg91/sms"
 *                   webhookSecret: "whsec_abc123..."
 *                   isActive: true
 *                   createdAt: "2024-01-10T10:00:00Z"
 *                   vendor:
 *                     id: clxvendor1
 *                     name: MSG91
 *                     slug: msg91
 *                   channel:
 *                     id: clxchannel1
 *                     name: SMS
 *                     type: sms
 *                   project:
 *                     id: clxproj1
 *                     name: E-commerce Platform
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *
 *   post:
 *     summary: Create a new webhook configuration
 *     description: |
 *       Create a new webhook configuration for a vendor-channel-project combination.
 *
 *       This will generate:
 *       - A unique webhook URL to configure in the vendor's dashboard
 *       - A webhook secret for signature verification (optional)
 *
 *       **Webhook URL Format:**
 *       ```
 *       https://webhook-manager-be.onrender.com/api/webhook/{project-slug}/{vendor-slug}/{channel-type}
 *       ```
 *     tags: [Vendors]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserVendorChannelRequest'
 *           example:
 *             vendorId: clxvendor1
 *             channelId: clxchannel1
 *             projectId: clxproj1
 *     responses:
 *       201:
 *         description: Configuration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 config:
 *                   $ref: '#/components/schemas/UserVendorChannel'
 *             example:
 *               message: Webhook configuration created successfully
 *               config:
 *                 id: clxconfig2
 *                 webhookUrl: "https://webhook-manager-be.onrender.com/api/webhook/ecommerce/msg91/whatsapp"
 *                 webhookSecret: "whsec_xyz789..."
 *                 isActive: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Configuration already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Configuration for this vendor-channel-project already exists
 */

/**
 * @swagger
 * /api/vendors/user-configs/{id}:
 *   delete:
 *     summary: Delete a webhook configuration
 *     description: |
 *       Delete a webhook configuration.
 *
 *       **Warning:** After deletion:
 *       - The webhook URL will no longer work
 *       - Historical data will be preserved
 *       - You'll need to update vendor settings to remove the webhook URL
 *     tags: [Vendors]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Configuration ID
 *         schema:
 *           type: string
 *         example: clxconfig1
 *     responses:
 *       200:
 *         description: Configuration deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Configuration deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/channels:
 *   get:
 *     summary: Get all channels (alternative endpoint)
 *     description: |
 *       Alternative endpoint to retrieve all channels.
 *       Same as `/api/vendors/channels`.
 *     tags: [Vendors]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Channels retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 channels:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Channel'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

export {};
