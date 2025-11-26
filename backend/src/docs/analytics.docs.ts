/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Get dashboard statistics
 *     description: |
 *       Retrieve comprehensive dashboard statistics including:
 *       - Message totals and rates
 *       - Daily breakdown
 *       - Vendor performance
 *
 *       **Caching:** Results are cached for 5 minutes. Use `nocache=true` to bypass.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PeriodParam'
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *       - $ref: '#/components/parameters/VendorIdParam'
 *       - $ref: '#/components/parameters/ChannelIdParam'
 *       - $ref: '#/components/parameters/NoCacheParam'
 *     responses:
 *       200:
 *         description: Dashboard statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DashboardStats'
 *             example:
 *               summary:
 *                 totalMessages: 1845
 *                 totalSent: 1800
 *                 totalDelivered: 1650
 *                 totalRead: 1200
 *                 totalFailed: 45
 *                 deliveryRate: 91.67
 *                 readRate: 66.67
 *                 failureRate: 2.5
 *               dailyStats:
 *                 - date: "2024-01-15"
 *                   totalMessages: 250
 *                   totalSent: 245
 *                   totalDelivered: 230
 *                   totalRead: 180
 *                   totalFailed: 5
 *                   successRate: 98.0
 *               vendorStats:
 *                 - vendorId: clxvendor1
 *                   vendorName: MSG91
 *                   totalMessages: 1200
 *                   successRate: 95.5
 *               period: "7d"
 *               meta:
 *                 cached: true
 *                 cachedAt: "2024-01-15T10:25:00Z"
 *                 expiresIn: 245
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/vendor-channel:
 *   get:
 *     summary: Get vendor-channel analytics
 *     description: |
 *       Detailed analytics broken down by vendor and channel combination.
 *
 *       Includes:
 *       - Message counts per vendor-channel
 *       - Delivery and success rates
 *       - Failure reasons analysis
 *       - Event breakdown
 *
 *       **Performance:** Limited to 50,000 events by default. Use `limit` parameter to adjust.
 *
 *       **Caching:** Results are cached for 5 minutes.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PeriodParam'
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *       - $ref: '#/components/parameters/NoCacheParam'
 *       - name: limit
 *         in: query
 *         description: Maximum number of events to process (default 50000, max 100000)
 *         schema:
 *           type: integer
 *           default: 50000
 *           maximum: 100000
 *     responses:
 *       200:
 *         description: Vendor-channel analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VendorChannelAnalytics'
 *             example:
 *               vendorChannelStats:
 *                 - vendor: MSG91
 *                   channel: sms
 *                   totalMessages: 1425
 *                   sent: 1400
 *                   delivered: 1194
 *                   read: 0
 *                   failed: 231
 *                   deliveryRate: 83.8
 *                   successRate: 83.8
 *                   failureRate: 16.2
 *                   events:
 *                     - eventName: DELIVERED
 *                       count: 1194
 *                     - eventName: FAILED
 *                       count: 231
 *                   failureReasons:
 *                     - reason: Invalid number
 *                       count: 150
 *                     - reason: Network error
 *                       count: 81
 *                 - vendor: SendGrid
 *                   channel: email
 *                   totalMessages: 375
 *                   sent: 375
 *                   delivered: 310
 *                   read: 0
 *                   failed: 62
 *                   deliveryRate: 82.7
 *                   successRate: 83.5
 *               summary:
 *                 totalVendorChannelCombinations: 3
 *                 totalMessages: 1845
 *                 eventsProcessed: 5000
 *                 limitReached: false
 *               period: "7d"
 *               dateRange:
 *                 startDate: "2024-01-08T00:00:00Z"
 *                 endDate: "2024-01-15T23:59:59Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/channels:
 *   get:
 *     summary: Get channel-wise analytics
 *     description: |
 *       Analytics grouped by communication channel (SMS, WhatsApp, Email).
 *
 *       Includes:
 *       - Per-channel message statistics
 *       - Vendor breakdown within each channel
 *       - Daily stats per channel
 *       - Failure analysis
 *
 *       **Performance:** Limited to 50,000 events by default.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PeriodParam'
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *       - $ref: '#/components/parameters/NoCacheParam'
 *       - name: limit
 *         in: query
 *         description: Maximum number of events to process
 *         schema:
 *           type: integer
 *           default: 50000
 *     responses:
 *       200:
 *         description: Channel analytics retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               channelStats:
 *                 - channel: sms
 *                   totalMessages: 1470
 *                   sent: 1450
 *                   delivered: 1300
 *                   read: 0
 *                   failed: 170
 *                   deliveryRate: 88.4
 *                   successRate: 88.4
 *                   vendors:
 *                     - vendor: MSG91
 *                       sent: 1200
 *                       delivered: 1100
 *                       failed: 100
 *                       successRate: 91.7
 *                     - vendor: Karix
 *                       sent: 250
 *                       delivered: 200
 *                       failed: 70
 *                       successRate: 72.0
 *                   dailyStats:
 *                     - date: "2024-01-15"
 *                       sent: 200
 *                       delivered: 180
 *                       failed: 20
 *                 - channel: email
 *                   totalMessages: 375
 *                   sent: 375
 *                   delivered: 310
 *                   failed: 65
 *                   deliveryRate: 82.7
 *               summary:
 *                 totalChannels: 3
 *                 totalMessages: 1845
 *                 eventsProcessed: 4500
 *                 limitReached: false
 *               period: "7d"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/failures:
 *   get:
 *     summary: Get failure analytics
 *     description: |
 *       Detailed analysis of message failures.
 *
 *       Includes:
 *       - Failure reasons with counts
 *       - Percentage breakdown
 *       - Affected vendors per reason
 *       - Trends over time
 *
 *       Useful for identifying and resolving delivery issues.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PeriodParam'
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *       - $ref: '#/components/parameters/VendorIdParam'
 *       - $ref: '#/components/parameters/ChannelIdParam'
 *       - $ref: '#/components/parameters/NoCacheParam'
 *     responses:
 *       200:
 *         description: Failure analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FailureAnalytics'
 *             example:
 *               failureStats:
 *                 - reason: Invalid phone number
 *                   count: 150
 *                   percentage: 33.3
 *                   vendors:
 *                     - MSG91
 *                     - Karix
 *                 - reason: Network timeout
 *                   count: 100
 *                   percentage: 22.2
 *                   vendors:
 *                     - MSG91
 *                 - reason: Spam detected
 *                   count: 80
 *                   percentage: 17.8
 *                   vendors:
 *                     - SendGrid
 *                 - reason: Invalid email format
 *                   count: 70
 *                   percentage: 15.6
 *                   vendors:
 *                     - SendGrid
 *                 - reason: DND registered
 *                   count: 50
 *                   percentage: 11.1
 *                   vendors:
 *                     - MSG91
 *               summary:
 *                 totalFailures: 450
 *                 uniqueReasons: 5
 *                 failureRate: 5.2
 *               period: "7d"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/projects:
 *   get:
 *     summary: Get project-wise analytics
 *     description: |
 *       Analytics broken down by project.
 *       Useful for comparing performance across different projects.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PeriodParam'
 *       - $ref: '#/components/parameters/NoCacheParam'
 *     responses:
 *       200:
 *         description: Project analytics retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               projectStats:
 *                 - projectId: clxproj1
 *                   projectName: E-commerce Platform
 *                   totalMessages: 1200
 *                   delivered: 1100
 *                   failed: 100
 *                   successRate: 91.7
 *                 - projectId: clxproj2
 *                   projectName: Mobile App
 *                   totalMessages: 645
 *                   delivered: 590
 *                   failed: 55
 *                   successRate: 91.5
 *               period: "7d"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics/events:
 *   get:
 *     summary: Get raw event analytics
 *     description: |
 *       Retrieve raw event data with detailed payload information.
 *       Useful for debugging and detailed analysis.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/PeriodParam'
 *       - $ref: '#/components/parameters/ProjectIdParam'
 *       - $ref: '#/components/parameters/VendorIdParam'
 *       - $ref: '#/components/parameters/ChannelIdParam'
 *       - name: status
 *         in: query
 *         description: Filter by event status
 *         schema:
 *           type: string
 *           enum: [sent, delivered, read, failed]
 *       - name: page
 *         in: query
 *         description: Page number for pagination
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         description: Number of events per page
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Events retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               events:
 *                 - id: clxevent1
 *                   messageId: clxmsg1
 *                   status: delivered
 *                   timestamp: "2024-01-15T10:30:00Z"
 *                   reason: null
 *                   message:
 *                     recipient: "+1234567890"
 *                     vendor: MSG91
 *                     channel: SMS
 *               pagination:
 *                 page: 1
 *                 limit: 50
 *                 total: 1845
 *                 totalPages: 37
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/analytics:
 *   get:
 *     summary: Get general analytics (legacy)
 *     description: |
 *       Legacy endpoint for basic analytics.
 *       Use `/api/analytics/dashboard` for more comprehensive data.
 *     tags: [Analytics]
 *     security:
 *       - BearerAuth: []
 *     deprecated: true
 *     parameters:
 *       - $ref: '#/components/parameters/PeriodParam'
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

export {};
