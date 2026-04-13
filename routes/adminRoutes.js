import express from 'express';
import { verifyJwt, requireRole } from '../middleware/auth.js';
import { createOrder, listOrders, deleteOrder } from '../controllers/adminOrderController.js';
import { listTasks, patchAdminTask, uploadAdminTaskPhoto } from '../controllers/adminTaskController.js';
import { listEmployees } from '../controllers/adminEmployeeController.js';
import { completionUpload } from '../middleware/upload.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.use(verifyJwt);
router.use(requireRole('admin'));

router.post('/orders', asyncHandler(createOrder));
router.get('/orders', asyncHandler(listOrders));
router.delete('/orders/:orderId', asyncHandler(deleteOrder));
router.get('/tasks', asyncHandler(listTasks));
router.post('/tasks/:taskId', asyncHandler(patchAdminTask));
router.post('/tasks/:taskId/photo', completionUpload.single('photo'), asyncHandler(uploadAdminTaskPhoto));
router.get('/employees', asyncHandler(listEmployees));

export default router;
