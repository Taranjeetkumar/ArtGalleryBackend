import express from 'express';
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  createVersion,
  forkProject,
  voteProject,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
  generateShareLink,
  joinViaShareLink,
  getMyProjects
} from '../controllers/projectController.js';
import { protect, optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(getProjects)
  .post(protect, createProject);

router.get('/my-projects', protect, getMyProjects);

router.route('/:id')
  .get(optionalAuth, getProject)
  .put(protect, updateProject)
  .delete(protect, deleteProject);

router.post('/:id/versions', protect, createVersion);
router.post('/:id/fork', protect, forkProject);
router.post('/:id/vote', protect, voteProject);

// Collaboration routes
router.post('/:id/collaborators', protect, addCollaborator);
router.delete('/:id/collaborators', protect, removeCollaborator);
router.put('/:id/collaborators/role', protect, updateCollaboratorRole);
router.post('/:id/share-link', protect, generateShareLink);
router.post('/:id/join/:token', protect, joinViaShareLink);

export default router;
