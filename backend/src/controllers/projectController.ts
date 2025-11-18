import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

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
export const createProject = async (req: Request, res: Response) => {
  try {
    const { name, description } = createProjectSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if project name already exists for this user
    const existingProject = await prisma.project.findFirst({
      where: {
        name,
        userId,
      },
    });

    if (existingProject) {
      return res.status(400).json({ error: 'Project name already exists' });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        userId,
      },
    });

    res.status(201).json({
      message: 'Project created successfully',
      project,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
};

// Get all projects for the authenticated user
export const getProjects = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userType = req.user?.accountType;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    let projects;

    if (userType === 'PARENT') {
      // Parent users see their own projects
      projects = await prisma.project.findMany({
        where: {
          userId,
        },
        include: {
          _count: {
            select: {
              vendors: true,
              channels: true,
              messages: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      // Child users see projects they have access to
      const projectAccess = await prisma.projectAccess.findMany({
        where: {
          userId,
        },
        include: {
          project: {
            include: {
              _count: {
                select: {
                  vendors: true,
                  channels: true,
                  messages: true,
                },
              },
            },
          },
        },
      });

      projects = projectAccess.map(access => access.project);
    }

    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
};

// Get a specific project
export const getProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    const userType = req.user?.accountType;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
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
        return res.status(403).json({ error: 'Access denied to this project' });
      }
    }

    const project = await prisma.project.findFirst({
      where: whereClause,
      include: {
        vendors: true,
        channels: true,
        _count: {
          select: {
            vendors: true,
            channels: true,
            messages: true,
            userVendorChannels: true,
          },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
};

// Update a project
export const updateProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = updateProjectSchema.parse(req.body);
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Only project owner can update
    const existingProject = await prisma.project.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found or access denied' });
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
        return res.status(400).json({ error: 'Project name already exists' });
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id },
      data: updateData,
    });

    res.json({
      message: 'Project updated successfully',
      project: updatedProject,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    console.error('Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
};

// Delete a project
export const deleteProject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Only project owner can delete
    const project = await prisma.project.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Delete project (will cascade to all related data)
    await prisma.project.delete({
      where: { id },
    });

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
};

// Grant project access to child account
export const grantProjectAccess = async (req: Request, res: Response) => {
  try {
    const { projectId, childUserId, accessType } = req.body;
    const parentUserId = req.user?.userId;

    if (!parentUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Validate access type
    if (!['specific', 'all'].includes(accessType)) {
      return res.status(400).json({ error: 'Invalid access type' });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: parentUserId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
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
      return res.status(404).json({ error: 'Child account not found' });
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
    console.error('Error granting project access:', error);
    res.status(500).json({ error: 'Failed to grant project access' });
  }
};

// Revoke project access from child account
export const revokeProjectAccess = async (req: Request, res: Response) => {
  try {
    const { projectId, childUserId } = req.params;
    const parentUserId = req.user?.userId;

    if (!parentUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId: parentUserId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Remove access
    await prisma.projectAccess.deleteMany({
      where: {
        projectId,
        userId: childUserId,
      },
    });

    res.json({ message: 'Project access revoked successfully' });
  } catch (error) {
    console.error('Error revoking project access:', error);
    res.status(500).json({ error: 'Failed to revoke project access' });
  }
};

// Get child accounts with project access information
export const getProjectAccessList = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify project ownership
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    // Get all child accounts and their access status
    const childAccounts = await prisma.user.findMany({
      where: {
        parentId: userId,
        accountType: 'CHILD',
      },
      include: {
        projectAccess: {
          where: {
            projectId,
          },
        },
      },
    });

    const accessList = childAccounts.map(child => ({
      id: child.id,
      name: child.name,
      email: child.email,
      hasAccess: child.projectAccess.length > 0,
      accessType: child.projectAccess[0]?.accessType || null,
      grantedAt: child.projectAccess[0]?.createdAt || null,
    }));

    res.json({ accessList });
  } catch (error) {
    console.error('Error fetching project access list:', error);
    res.status(500).json({ error: 'Failed to fetch project access list' });
  }
};