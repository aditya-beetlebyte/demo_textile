import express from 'express';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { addTaskUpdate, listMyTasks } from '../controllers/employeeTaskController.js';
import { completionUpload } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(verifyJwt);
router.use(requireRole('dri'));

router.get('/tasks', asyncHandler(listMyTasks));
router.patch(
  '/tasks/:taskId/update',
  completionUpload.single('photo'),
  asyncHandler(addTaskUpdate)
);

export default router;
