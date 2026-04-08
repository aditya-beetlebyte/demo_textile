import Order from '../models/Order.js';
import { ORDER_TYPES } from '../models/constants.js';
import { createOrderWithTasks } from '../services/orderCreation.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { startOfDayUTC, addCalendarDaysUTC } from '../utils/date.js';
import mongoose from 'mongoose';

export const createOrder = asyncHandler(async (req, res) => {
  const { orderType, orderedByName, orderDate } = req.body || {};
  if (!orderType || !orderedByName || !orderDate) {
    const err = new Error('orderType, orderedByName, and orderDate are required');
    err.statusCode = 400;
    throw err;
  }
  if (!ORDER_TYPES.includes(orderType)) {
    const err = new Error(`orderType must be one of: ${ORDER_TYPES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }
  const { order, tasks } = await createOrderWithTasks({
    orderType,
    orderedByName,
    orderDate,
    createdById: req.user._id,
  });
  res.status(201).json({
    order,
    taskCount: tasks.length,
  });
});

export const listOrders = asyncHandler(async (req, res) => {
  const { q, orderType, from, to } = req.query;
  const filter = {};

  if (orderType) {
    if (!ORDER_TYPES.includes(orderType)) {
      const err = new Error(`orderType must be one of: ${ORDER_TYPES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    filter.orderType = orderType;
  }
  if (q && String(q).trim()) {
    filter.orderedByName = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }
  if (from || to) {
    filter.orderDate = {};
    if (from) filter.orderDate.$gte = startOfDayUTC(from);
    if (to) {
      filter.orderDate.$lt = addCalendarDaysUTC(startOfDayUTC(to), 1);
    }
  }

  const orders = await Order.find(filter).sort({ orderDate: -1, createdAt: -1 }).limit(200).lean();

  res.json({ orders });
});

export const deleteOrder = asyncHandler(async (req, res) => {
  const { orderId } = req.params;
  if (!mongoose.isValidObjectId(orderId)) {
    const err = new Error('Invalid orderId');
    err.statusCode = 400;
    throw err;
  }

  const deleted = await Order.findOneAndDelete({ _id: orderId });
  if (!deleted) {
    const err = new Error('Order not found');
    err.statusCode = 404;
    throw err;
  }

  // Tasks are deleted automatically by Mongoose cascade middleware in models/Order.js
  res.json({ ok: true, orderId });
});
