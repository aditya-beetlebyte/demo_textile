import mongoose from 'mongoose';
import Order from '../models/Order.js';
import OrderTask from '../models/OrderTask.js';
import { ORDER_TYPES } from '../models/constants.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { startOfDayUTC, addCalendarDaysUTC } from '../utils/date.js';
import { uploadTaskPhoto } from '../utils/gcs.js';

async function applyTaskUpdate({ task, actor, note, imageUrl, nextStatus }) {
  const statusFrom = task.status;
  const shouldChangeStatus = nextStatus && nextStatus !== task.status;

  if (note !== undefined) {
    task.comment = note != null ? String(note) : task.comment;
  }
  if (imageUrl) {
    task.photoUrl = imageUrl;
  }
  if (shouldChangeStatus) {
    task.status = nextStatus;
    task.completedAt = nextStatus === 'completed' ? new Date() : null;
  }

  const updateNote =
    note !== undefined ? (note != null ? String(note) : '') : '';
  task.updates.push({
    actor: actor._id,
    actorRole: actor.role,
    note: updateNote,
    imageUrl: imageUrl || '',
    statusFrom: shouldChangeStatus ? statusFrom : null,
    statusTo: shouldChangeStatus ? nextStatus : null,
  });
  await task.save();
}

export const listMyTasks = asyncHandler(async (req, res) => {
  const { from, to, orderId, orderType } = req.query;
  const filter = { assignee: req.user._id };

  if (from || to) {
    filter.dueDate = {};
    if (from) filter.dueDate.$gte = startOfDayUTC(from);
    if (to) filter.dueDate.$lt = addCalendarDaysUTC(startOfDayUTC(to), 1);
  }

  const orderFilter = {};
  if (orderType) {
    if (!ORDER_TYPES.includes(orderType)) {
      const err = new Error(`orderType must be one of: ${ORDER_TYPES.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }
    orderFilter.orderType = orderType;
  }
  if (orderId) {
    if (!mongoose.isValidObjectId(orderId)) {
      const err = new Error('Invalid orderId');
      err.statusCode = 400;
      throw err;
    }
    orderFilter._id = orderId;
  }

  if (Object.keys(orderFilter).length) {
    const orders = await Order.find(orderFilter).select('_id').lean();
    filter.order = { $in: orders.map((o) => o._id) };
    if (!orders.length) {
      return res.json({
        tasks: [],
        totalTaskCount: 0,
        pendingTaskCount: 0,
        completedTaskCount: 0,
      });
    }
  }

  const [totalTaskCount, pendingTaskCount, completedTaskCount] = await Promise.all([
    OrderTask.countDocuments(filter),
    OrderTask.countDocuments({ ...filter, status: 'pending' }),
    OrderTask.countDocuments({ ...filter, status: 'completed' }),
  ]);

  const tasks = await OrderTask.find(filter)
    .populate('order', 'orderType orderedByName orderDate')
    .populate('updates.actor', 'name email role')
    .sort({ dueDate: 1, title: 1 })
    .limit(500)
    .lean();

  res.json({
    tasks,
    totalTaskCount,
    pendingTaskCount,
    completedTaskCount,
  });
});

export const completeTask = asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  if (!mongoose.isValidObjectId(taskId)) {
    const err = new Error('Invalid taskId');
    err.statusCode = 400;
    throw err;
  }

  const task = await OrderTask.findOne({ _id: taskId, assignee: req.user._id });
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  const comment = req.body && req.body.comment != null ? String(req.body.comment) : '';

  let photoUrl = task.photoUrl || '';
  if (req.file && req.file.buffer) {
    photoUrl = await uploadTaskPhoto({
      buffer: req.file.buffer,
      contentType: req.file.mimetype,
      orderId: task.order.toString(),
      taskId: task._id.toString(),
      originalName: req.file.originalname,
    });
  }

  await applyTaskUpdate({
    task,
    actor: req.user,
    note: comment,
    imageUrl: photoUrl,
    nextStatus: 'completed',
  });

  const updated = await OrderTask.findById(task._id)
    .populate('order', 'orderType orderedByName orderDate')
    .populate('updates.actor', 'name email role')
    .lean();

  res.json({ task: updated });
});

async function loadAssignedTask(req) {
  const { taskId } = req.params;
  if (!mongoose.isValidObjectId(taskId)) {
    const err = new Error('Invalid taskId');
    err.statusCode = 400;
    throw err;
  }
  const task = await OrderTask.findOne({ _id: taskId, assignee: req.user._id });
  if (!task) {
    const err = new Error('Task not found');
    err.statusCode = 404;
    throw err;
  }
  return task;
}

async function respondWithTask(res, taskId) {
  const updated = await OrderTask.findById(taskId)
    .populate('order', 'orderType orderedByName orderDate')
    .populate('updates.actor', 'name email role')
    .lean();
  res.json({ task: updated });
}

/** JSON body: `note` and/or `status` (`pending` | `completed`). */
export const patchEmployeeTask = asyncHandler(async (req, res) => {
  const task = await loadAssignedTask(req);
  const hasNote = req.body && Object.prototype.hasOwnProperty.call(req.body, 'note');
  const note = hasNote ? (req.body.note != null ? String(req.body.note) : '') : undefined;
  const status = req.body && req.body.status != null ? String(req.body.status) : '';
  if (status && !['pending', 'completed'].includes(status)) {
    const err = new Error('status must be one of: pending, completed');
    err.statusCode = 400;
    throw err;
  }
  if (!hasNote && !status) {
    const err = new Error('Provide at least one of note or status');
    err.statusCode = 400;
    throw err;
  }

  await applyTaskUpdate({
    task,
    actor: req.user,
    note,
    imageUrl: '',
    nextStatus: status || null,
  });

  await respondWithTask(res, task._id);
});

/** Multipart: field `photo` (required). Optional `note`, `status` in the same form. */
export const uploadEmployeeTaskPhoto = asyncHandler(async (req, res) => {
  const task = await loadAssignedTask(req);
  if (!req.file || !req.file.buffer) {
    const err = new Error('photo is required');
    err.statusCode = 400;
    throw err;
  }
  const imageUrl = await uploadTaskPhoto({
    buffer: req.file.buffer,
    contentType: req.file.mimetype,
    orderId: task.order.toString(),
    taskId: task._id.toString(),
    originalName: req.file.originalname,
  });
  const hasNote = req.body && Object.prototype.hasOwnProperty.call(req.body, 'note');
  const note = hasNote ? (req.body.note != null ? String(req.body.note) : '') : undefined;
  const status = req.body && req.body.status != null ? String(req.body.status) : '';
  if (status && !['pending', 'completed'].includes(status)) {
    const err = new Error('status must be one of: pending, completed');
    err.statusCode = 400;
    throw err;
  }

  await applyTaskUpdate({
    task,
    actor: req.user,
    note,
    imageUrl,
    nextStatus: status || null,
  });

  await respondWithTask(res, task._id);
});
