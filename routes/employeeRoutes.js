import express from 'express';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { listMyTasks, patchEmployeeTask, uploadEmployeeTaskPhoto } from '../controllers/employeeTaskController.js';
import { completionUpload } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(verifyJwt);
router.use(requireRole('dri'));

router.get('/tasks', asyncHandler(listMyTasks));
router.post('/tasks/:taskId', asyncHandler(patchEmployeeTask));
router.post('/tasks/:taskId/photo', completionUpload.single('photo'), asyncHandler(uploadEmployeeTaskPhoto));

export default router;
