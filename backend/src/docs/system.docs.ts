/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: |
 *       Check the health status of the API server.
 *
 *       Returns:
 *       - Server status
 *       - Uptime
 *       - Redis connection status
 *       - Cron service status
 *
 *       Use this endpoint for:
 *       - Load balancer health checks
 *       - Monitoring systems
 *       - Status page integrations
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *             example:
 *               status: ok
 *               timestamp: "2024-01-15T10:30:00.000Z"
 *               uptime: 86400.5
 *               environment: production
 *               redis: connected
 *               cronService: true
 *       503:
 *         description: Server is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 error:
 *                   type: string
 *                   example: Health check failed
 */

/**
 * @swagger
 * /debug/users:
 *   get:
 *     summary: Debug - Get all users
 *     description: |
 *       **Debug endpoint** - Returns list of all users in the system.
 *
 *       ⚠️ **Warning:** This endpoint is for debugging purposes only.
 *       Should be disabled or protected in production.
 *
 *       Returns basic user information without sensitive data.
 *     tags: [System]
 *     security: []
 *     responses:
 *       200:
 *         description: User list retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               userCount: 5
 *               users:
 *                 - id: clxuser1
 *                   email: john@example.com
 *                   name: John Doe
 *                   accountType: PARENT
 *                 - id: clxuser2
 *                   email: jane@example.com
 *                   name: Jane Smith
 *                   accountType: PARENT
 *       500:
 *         description: Database query failed
 *         content:
 *           application/json:
 *             example:
 *               error: Database query failed
 *               details: Connection timeout
 */

export {};
