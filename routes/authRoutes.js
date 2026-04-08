import express from 'express';
import { login } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

router.post('/login', asyncHandler(login));

export default router;
