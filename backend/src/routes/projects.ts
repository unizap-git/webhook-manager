import { Router } from 'express';
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  grantProjectAccess,
  batchGrantProjectAccess,
  revokeProjectAccess,
  getProjectAccessList,
} from '../controllers/projectController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all project routes
router.use(authenticateToken);

// Project CRUD routes
router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProject);
router.put('/:id', updateProject);
router.delete('/:id', deleteProject);

// Project access management routes
router.post('/access', grantProjectAccess);
router.post('/batch-access', batchGrantProjectAccess);
router.post('/:projectId/access', grantProjectAccess);
router.delete('/:projectId/access/:childUserId', revokeProjectAccess);
router.get('/:projectId/access', getProjectAccessList);

export default router;