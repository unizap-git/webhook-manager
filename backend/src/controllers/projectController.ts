import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { cacheService } from '../services/cacheService';

interface AuthRequest extends Request {
  user?: {
    userId: string;
    email: string;
    accountType: string;
    parentId?: string;
  };
}

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long'),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Project name too long').optional(),
  description: z.string().optional(),
});

// Create a new project
export const createProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Check if project name already exists for this user
    const existingProject = await prisma.project.findFirst({
      where: {
        name,
        userId,
      },
    });

    if (existingProject) {
      res.status(400).json({ error: 'Project name already exists' });
      return;
    }

    const project = await prisma.project.create({
      data: {
        name,
        description: description || null,
        userId,
      },
    });

    // Invalidate projects cache for this user
    await cacheService.deletePattern(`analytics:projects:${userId}:*`);
    logger.debug(`🗑️  Cache invalidated for user ${userId} after project creation`);

    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues?.[0]?.message || 'Validation error' });
      return;
    }
    logger.error('Project creation failed:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

// Get all projects for the authenticated user
export const getProjects = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userType = req.user?.accountType;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let projects;

    if (userType === 'PARENT') {
      // Parent users see their own projects
      projects = await (prisma as any).project.findMany({
        where: {
          userId,
        },
        include: {
          _count: {
            select: {
              userVendorChannels: true,
              messages: true,
              projectAccess: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      // Child users see projects they have access to
      const projectAccess = await (prisma as any).projectAccess.findMany({
        where: {
          userId,
        },
        include: {
          project: {
            include: {
              _count: {
                select: {
                  userVendorChannels: true,
                  messages: true,
                  projectAccess: true,
                },
              },
            },
          },
        },
      });

      projects = projectAccess.map((access: any) => access.project);
    }

    res.json({ projects });
    return;
  } catch (error) {
    logger.error('Failed to fetch projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
    return;
  }
};

// Get a specific project
export const getProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userType = req.user?.accountType;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    // Build query based on user type
    let whereClause: any = { id };

    if (userType === 'PARENT') {
      whereClause.userId = userId;
    } else {
      // For child accounts, check if they have access to this project
      const hasAccess = await prisma.projectAccess.findFirst({
        where: {
          projectId: id,
          userId,
        },
      });

      if (!hasAccess) {
        res.status(403).json({ error: 'Access denied to this project' });
        return;
      }
    }

    const project = await prisma.project.findFirst({
      where: whereClause,
      include: {
        _count: {
          select: {
            userVendorChannels: true,
            messages: true,
          },
        },
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    res.json({ project });
  } catch (error) {
    logger.error('Failed to fetch project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// Update a project
export const updateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = updateProjectSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    // Only project owner can update
    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingProject) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    // If updating name, check for duplicates
    if (updateData.name && updateData.name !== existingProject.name) {
      const duplicateProject = await prisma.project.findFirst({
        where: {
          name: updateData.name,
          userId,
          id: { not: id },
        },
      });

      if (duplicateProject) {
        res.status(400).json({ error: 'Project name already exists' });
        return;
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.description !== undefined && { description: updateData.description || null }),
      },
    });

    res.json({
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues?.[0]?.message || 'Validation error' });
      return;
    }
    logger.error('Project update failed:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

// Delete a project
export const deleteProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!id) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    // Only project owner can delete
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    // Delete project (will cascade to all related data)
    await prisma.project.delete({
      where: { id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    logger.error('Project deletion failed:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

// Batch grant project access to child account for multiple projects
export const batchGrantProjectAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { childUserId, projectIds, accessType = 'specific' } = req.body;
    const parentUserId = req.user?.userId;

    if (!parentUserId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!childUserId) {
      res.status(400).json({ error: 'Child User ID is required' });
      return;
    }

    if (!projectIds || !Array.isArray(projectIds) || projectIds.length === 0) {
      res.status(400).json({ error: 'Project IDs array is required' });
      return;
    }

    // Validate access type
    if (!['specific', 'all'].includes(accessType)) {
      res.status(400).json({ error: 'Invalid access type' });
      return;
    }

    // Verify child account relationship
    const childUser = await prisma.user.findFirst({
      where: {
        id: childUserId,
        parentId: parentUserId,
        accountType: 'CHILD',
      },
    });

    if (!childUser) {
      res.status(404).json({ error: 'Child account not found' });
      return;
    }

    // Verify all projects belong to parent
    const projects = await prisma.project.findMany({
      where: {
        id: { in: projectIds },
        userId: parentUserId,
      },
    });

    if (projects.length !== projectIds.length) {
      res.status(404).json({ error: 'One or more projects not found or access denied' });
      return;
    }

    // Batch create or update access records
    const accessRecords = await Promise.all(
      projectIds.map(async (projectId) => {
        const existingAccess = await prisma.projectAccess.findFirst({
          where: {
            projectId,
            userId: childUserId,
          },
        });

        if (existingAccess) {
          return await prisma.projectAccess.update({
            where: { id: existingAccess.id },
            data: { accessType },
          });
        } else {
          return await prisma.projectAccess.create({
            data: {
              projectId,
              userId: childUserId,
              accessType,
              grantedBy: parentUserId,
            },
          });
        }
      })
    );

    res.json({
      message: `Project access granted successfully for ${accessRecords.length} project(s)`,
      projectAccess: accessRecords,
    });
  } catch (error) {
    logger.error('Failed to batch grant project access:', error);
    res.status(500).json({ error: 'Failed to batch grant project access' });
  }
};

// Grant project access to child account
export const grantProjectAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    // Support both URL param and body param for projectId
    const projectIdFromParams = req.params.projectId;
    const { projectId: projectIdFromBody, childUserId, accessType = 'specific' } = req.body;
    const projectId = projectIdFromParams || projectIdFromBody;
    const parentUserId = req.user?.userId;

    if (!parentUserId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    if (!projectId) {
      res.status(400).json({ error: 'Project ID is required' });
      return;
    }

    if (!childUserId) {
      res.status(400).json({ error: 'Child User ID is required' });
      return;
    }

    // Validate access type
    if (!['specific', 'all'].includes(accessType)) {
      res.status(400).json({ error: 'Invalid access type' });
      return;
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: parentUserId,
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    // Verify child account relationship
    const childUser = await prisma.user.findFirst({
      where: {
        id: childUserId,
        parentId: parentUserId,
        accountType: 'CHILD',
      },
    });

    if (!childUser) {
      res.status(404).json({ error: 'Child account not found' });
      return;
    }

    // Create or update access
    const existingAccess = await prisma.projectAccess.findFirst({
      where: {
        projectId,
        userId: childUserId,
      },
    });

    let projectAccess;
    if (existingAccess) {
      projectAccess = await prisma.projectAccess.update({
        where: { id: existingAccess.id },
        data: { accessType },
      });
    } else {
      projectAccess = await prisma.projectAccess.create({
        data: {
          projectId,
          userId: childUserId,
          accessType,
          grantedBy: parentUserId,
        },
      });
    }

    res.json({
      message: 'Project access granted successfully',
      projectAccess,
    });
  } catch (error) {
    logger.error('Failed to grant project access:', error);
    res.status(500).json({ error: 'Failed to grant project access' });
  }
};

// Revoke project access from child account
export const revokeProjectAccess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, childUserId } = req.params;
    const parentUserId = req.user?.userId;

    if (!parentUserId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        ...(projectId ? { id: projectId } : {}),
        ...(parentUserId ? { userId: parentUserId } : {})
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    // Remove access
    await prisma.projectAccess.deleteMany({
      where: {
        ...(projectId ? { projectId } : {}),
        ...(childUserId ? { userId: childUserId } : {})
      },
    });

    res.json({ message: 'Project access revoked successfully' });
  } catch (error) {
    logger.error('Failed to revoke project access:', error);
    res.status(500).json({ error: 'Failed to revoke project access' });
  }
};

// Get child accounts with project access information
export const getProjectAccessList = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        ...(projectId ? { id: projectId } : {}),
        ...(userId ? { userId } : {})
      },
    });

    if (!project) {
      res.status(404).json({ error: 'Project not found or access denied' });
      return;
    }

    // Get all child accounts and their access status
    const childAccounts = await prisma.user.findMany({
      where: {
        parentId: userId,
        accountType: 'CHILD',
      },
      include: {
        projectAccess: projectId ? {
          where: { projectId },
        } : true,
      },
    });

    const accessList = childAccounts.map(child => {
      const pa = (child as any).projectAccess as any[] | undefined;
      return {
        id: child.id,
        name: child.name,
        email: child.email,
        hasAccess: Array.isArray(pa) && pa.length > 0,
        accessType: Array.isArray(pa) && pa[0]?.accessType ? pa[0].accessType : null,
        grantedAt: Array.isArray(pa) && pa[0]?.createdAt ? pa[0].createdAt : null,
      };
    });

    res.json({ accessList });
  } catch (error) {
    logger.error('Failed to fetch project access list:', error);
    res.status(500).json({ error: 'Failed to fetch project access list' });
  }
};