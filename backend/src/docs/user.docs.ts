/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     summary: Get current user profile
 *     description: |
 *       Retrieve comprehensive profile information including:
 *       - Basic user details
 *       - Statistics (messages, projects, configurations)
 *       - Usage trends (last 30 days)
 *       - Recent activity
 *       - Top vendors
 *       - Child accounts (for parent accounts)
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserProfile'
 *             example:
 *               user:
 *                 id: clx1234567890
 *                 name: John Doe
 *                 email: john@example.com
 *                 accountType: PARENT
 *                 createdAt: "2024-01-15T10:30:00Z"
 *               stats:
 *                 totalMessages: 1845
 *                 activeConfigurations: 5
 *                 projectsCount: 3
 *                 childAccountsCount: 2
 *                 successRate: 94.5
 *                 avgDailyMessages: 263.57
 *               usageTrends:
 *                 - date: "2024-01-15"
 *                   count: 250
 *                 - date: "2024-01-14"
 *                   count: 230
 *               recentActivity:
 *                 - id: clxabc123
 *                   recipient: "+1234567890"
 *                   vendor: MSG91
 *                   channel: SMS
 *                   status: delivered
 *                   timestamp: "2024-01-15T10:30:00Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/user/change-password:
 *   post:
 *     summary: Change account password
 *     description: |
 *       Change the password for the current authenticated user.
 *       Requires the current password for verification.
 *     tags: [User]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *           example:
 *             currentPassword: OldPassword123
 *             newPassword: NewSecurePass456
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Password changed successfully
 *       400:
 *         description: Invalid current password or validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Current password is incorrect
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * @swagger
 * /api/user/child-accounts:
 *   get:
 *     summary: Get all child accounts
 *     description: |
 *       Retrieve all child accounts created by the parent account.
 *       Includes project access information for each child.
 *
 *       **Note:** Only available for PARENT accounts.
 *     tags: [Child Accounts]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Child accounts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 childAccounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ChildAccount'
 *             example:
 *               childAccounts:
 *                 - id: clx1111
 *                   name: Sales Team
 *                   email: sales@example.com
 *                   accountType: CHILD
 *                   createdAt: "2024-01-10T10:00:00Z"
 *                   projectAccess:
 *                     - projectId: clxproj1
 *                       projectName: E-commerce
 *                       accessType: specific
 *                 - id: clx2222
 *                   name: Support Team
 *                   email: support@example.com
 *                   accountType: CHILD
 *                   createdAt: "2024-01-12T10:00:00Z"
 *                   projectAccess: []
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *
 *   post:
 *     summary: Create a new child account
 *     description: |
 *       Create a child account under the parent account.
 *       Child accounts:
 *       - Have limited access based on project permissions
 *       - Cannot create other accounts
 *       - Can only view assigned projects' analytics
 *
 *       **Note:** Only available for PARENT accounts.
 *     tags: [Child Accounts]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateChildAccountRequest'
 *           example:
 *             name: Marketing Team
 *             email: marketing@example.com
 *             password: TeamPass123
 *     responses:
 *       201:
 *         description: Child account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 childAccount:
 *                   $ref: '#/components/schemas/ChildAccount'
 *             example:
 *               message: Child account created successfully
 *               childAccount:
 *                 id: clx3333
 *                 name: Marketing Team
 *                 email: marketing@example.com
 *                 accountType: CHILD
 *                 createdAt: "2024-01-15T10:30:00Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       409:
 *         description: Email already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Email already registered
 */

/**
 * @swagger
 * /api/user/child-accounts/{childId}/reset-password:
 *   post:
 *     summary: Reset child account password
 *     description: |
 *       Reset the password for a child account.
 *       A new temporary password will be generated or you can provide one.
 *
 *       **Note:** Only available for PARENT accounts.
 *     tags: [Child Accounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: childId
 *         in: path
 *         required: true
 *         description: ID of the child account
 *         schema:
 *           type: string
 *         example: clx1234567890
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 description: Optional new password (generated if not provided)
 *           example:
 *             newPassword: NewChildPass123
 *     responses:
 *       200:
 *         description: Password reset successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Password reset successfully
 *               temporaryPassword: TempPass123
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/user/child-accounts/{childId}:
 *   delete:
 *     summary: Delete a child account
 *     description: |
 *       Permanently delete a child account.
 *       This action cannot be undone.
 *
 *       **Note:** Only available for PARENT accounts.
 *     tags: [Child Accounts]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: childId
 *         in: path
 *         required: true
 *         description: ID of the child account to delete
 *         schema:
 *           type: string
 *         example: clx1234567890
 *     responses:
 *       200:
 *         description: Child account deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Child account deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

export {};
