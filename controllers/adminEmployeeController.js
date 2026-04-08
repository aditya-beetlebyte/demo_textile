import Employee from '../models/Employee.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const listEmployees = asyncHandler(async (req, res) => {
  const employees = await Employee.find({ role: 'dri', isActive: true })
    .select('name email')
    .sort({ name: 1 })
    .lean();
  res.json({ employees });
});
