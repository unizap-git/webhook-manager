/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all projects
 *     description: |
 *       Retrieve all projects accessible to the current user.
 *       - Parent accounts: All owned projects
 *       - Child accounts: Only projects they have been granted access to
 *
 *       Includes message and configuration counts for each project.
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *             example:
 *               projects:
 *                 - id: clxproj1
 *                   name: E-commerce Platform
 *                   description: Webhooks for our online store
 *                   userId: clxuser1
 *                   createdAt: "2024-01-10T10:00:00Z"
 *                   updatedAt: "2024-01-15T10:30:00Z"
 *                   _count:
 *                     messages: 1500
 *                     userVendorChannels: 3
 *                 - id: clxproj2
 *                   name: Mobile App
 *                   description: Push notification webhooks
 *                   userId: clxuser1
 *                   createdAt: "2024-01-12T10:00:00Z"
 *                   updatedAt: "2024-01-14T10:30:00Z"
 *                   _count:
 *                     messages: 800
 *                     userVendorChannels: 2
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *
 *   post:
 *     summary: Create a new project
 *     description: |
 *       Create a new project to organize your webhook configurations.
 *       Project names must be unique per user.
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProjectRequest'
 *           examples:
 *             basic:
 *               summary: Basic project
 *               value:
 *                 name: My New Project
 *             withDescription:
 *               summary: Project with description
 *               value:
 *                 name: E-commerce Platform
 *                 description: Webhook configurations for our e-commerce store
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *             example:
 *               message: Project created successfully
 *               project:
 *                 id: clxproj3
 *                 name: My New Project
 *                 description: null
 *                 userId: clxuser1
 *                 createdAt: "2024-01-15T10:30:00Z"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Project name already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: Project with this name already exists
 */

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     summary: Get a specific project
 *     description: Retrieve details of a specific project by ID
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: clxproj1
 *     responses:
 *       200:
 *         description: Project retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *
 *   put:
 *     summary: Update a project
 *     description: Update project name or description
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: clxproj1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProjectRequest'
 *           example:
 *             name: Updated Project Name
 *             description: New description for the project
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *
 *   delete:
 *     summary: Delete a project
 *     description: |
 *       Permanently delete a project and all associated data.
 *
 *       **Warning:** This will also delete:
 *       - All webhook configurations
 *       - All messages and events
 *       - All access grants to child accounts
 *
 *       This action cannot be undone.
 *     tags: [Projects]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: clxproj1
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Project deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/projects/access:
 *   post:
 *     summary: Grant project access to child account
 *     description: |
 *       Grant a child account access to a specific project.
 *       Only parent accounts can grant access.
 *     tags: [Project Access]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GrantAccessRequest'
 *           example:
 *             childUserId: clxchild1
 *             projectId: clxproj1
 *             accessType: specific
 *     responses:
 *       200:
 *         description: Access granted successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Project access granted successfully
 *               access:
 *                 projectId: clxproj1
 *                 userId: clxchild1
 *                 accessType: specific
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/projects/batch-access:
 *   post:
 *     summary: Grant access to multiple projects at once
 *     description: |
 *       Grant a child account access to multiple projects in a single request.
 *       Useful when onboarding a new team member.
 *     tags: [Project Access]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BatchGrantAccessRequest'
 *           example:
 *             childUserId: clxchild1
 *             projectIds:
 *               - clxproj1
 *               - clxproj2
 *               - clxproj3
 *     responses:
 *       200:
 *         description: Access granted to all projects
 *         content:
 *           application/json:
 *             example:
 *               message: Access granted to 3 projects
 *               granted:
 *                 - clxproj1
 *                 - clxproj2
 *                 - clxproj3
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */

/**
 * @swagger
 * /api/projects/{projectId}/access:
 *   get:
 *     summary: Get project access list
 *     description: |
 *       Get list of all child accounts that have access to a project.
 *     tags: [Project Access]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: clxproj1
 *     responses:
 *       200:
 *         description: Access list retrieved successfully
 *         content:
 *           application/json:
 *             example:
 *               projectId: clxproj1
 *               projectName: E-commerce Platform
 *               accessList:
 *                 - userId: clxchild1
 *                   userName: Sales Team
 *                   userEmail: sales@example.com
 *                   accessType: specific
 *                   grantedAt: "2024-01-10T10:00:00Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

/**
 * @swagger
 * /api/projects/{projectId}/access/{childUserId}:
 *   delete:
 *     summary: Revoke project access from child account
 *     description: |
 *       Remove a child account's access to a specific project.
 *     tags: [Project Access]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - name: projectId
 *         in: path
 *         required: true
 *         description: Project ID
 *         schema:
 *           type: string
 *         example: clxproj1
 *       - name: childUserId
 *         in: path
 *         required: true
 *         description: Child account user ID
 *         schema:
 *           type: string
 *         example: clxchild1
 *     responses:
 *       200:
 *         description: Access revoked successfully
 *         content:
 *           application/json:
 *             example:
 *               message: Project access revoked successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */

export {};
