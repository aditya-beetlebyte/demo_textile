import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee.js';
import Order from '../models/Order.js';
import OrderTask from '../models/OrderTask.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export function signToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET not configured');
    err.statusCode = 500;
    throw err;
  }
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
      name: user.name,
    },
    secret,
    { expiresIn: '7d' }
  );
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    const err = new Error('email and password required');
    err.statusCode = 400;
    throw err;
  }
  const user = await Employee.findOne({ email: String(email).toLowerCase().trim() }).select(
    '+passwordHash'
  );
  if (!user || !user.isActive) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    const err = new Error('Invalid credentials');
    err.statusCode = 401;
    throw err;
  }
  const token = signToken(user);

  // Demo behavior expected by your UI:
  // - Admin login returns all orders so the admin panel can render immediately.
  // - DRI login returns all tasks assigned to that employee (pending + completed).
  let extra = {};
  if (user.role === 'admin') {
    const orders = await Order.find({})
      .sort({ orderDate: -1, createdAt: -1 })
      .limit(500)
      .lean();
    extra = { orders, orderCount: orders.length };
  } else if (user.role === 'dri') {
    const tasks = await OrderTask.find({ assignee: user._id })
      .populate('order', 'orderType orderedByName orderDate')
      .populate('updates.actor', 'name email role')
      .sort({ dueDate: 1, title: 1 })
      .limit(2000)
      .lean();
    const pendingTaskCount = tasks.filter((t) => t.status === 'pending').length;
    const inProgressTaskCount = tasks.filter((t) => t.status === 'in_progress').length;
    const inReviewTaskCount = tasks.filter((t) => t.status === 'in_review').length;
    const completedTaskCount = tasks.filter((t) => t.status === 'completed').length;
    extra = {
      tasks,
      taskCount: tasks.length,
      pendingTaskCount,
      inProgressTaskCount,
      inReviewTaskCount,
      completedTaskCount,
    };
  }

  res.json({
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    ...extra,
  });
});
