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
  getMyProjects
} from '../controllers/projectController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.route('/')
  .get(getProjects)
  .post(protect, createProject);

router.get('/my-projects', protect, getMyProjects);

router.route('/:id')
  .get(protect, getProject)
  .put(protect, updateProject)
  .delete(protect, deleteProject);

router.post('/:id/versions', protect, createVersion);
router.post('/:id/fork', protect, forkProject);
router.post('/:id/vote', protect, voteProject);
router.post('/:id/collaborators', protect, addCollaborator);

export default router;
