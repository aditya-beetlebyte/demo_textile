import mongoose from 'mongoose';
import Order from '../models/Order.js';
import OrderTask from '../models/OrderTask.js';
import TaskDefinition from '../models/TaskDefinition.js';
import Employee from '../models/Employee.js';
import { ORDER_TYPES } from '../models/constants.js';
import { startOfDayUTC, addCalendarDaysUTC } from '../utils/date.js';

export async function resolveAssigneeId(def) {
  if (def.dri) {
    return def.dri;
  }
  const emp = await Employee.findOne({ name: def.driLabel, role: 'dri', isActive: true });
  if (!emp) {
    const err = new Error(`No active DRI employee matches driLabel: ${def.driLabel}`);
    err.statusCode = 400;
    throw err;
  }
  return emp._id;
}

function isTransactionUnsupportedError(err) {
  const msg = String(err && err.message ? err.message : '');
  return (
    /replica set/i.test(msg) ||
    /Transactions are not supported/i.test(msg) ||
    err.code === 20
  );
}

/**
 * @param {{ orderType: string, orderedByName: string, orderDate: Date|string, createdById: import('mongoose').Types.ObjectId }}
 */
export async function createOrderWithTasks({ orderType, orderedByName, orderDate, createdById }) {
  if (!ORDER_TYPES.includes(orderType)) {
    const err = new Error(`Invalid orderType. Must be one of: ${ORDER_TYPES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const definitions = await TaskDefinition.find({
    isActive: true,
    orderTypes: orderType,
  }).sort({ sortOrder: 1 });

  if (!definitions.length) {
    const err = new Error('No task definitions found for this order type');
    err.statusCode = 500;
    throw err;
  }

  const anchor = startOfDayUTC(orderDate);
  const rows = [];
  for (const def of definitions) {
    const assignee = await resolveAssigneeId(def);
    const dueDate = addCalendarDaysUTC(anchor, def.offsetDays);
    rows.push({ def, assignee, dueDate });
  }

  const buildTaskDocs = (orderId) =>
    rows.map(({ def, assignee, dueDate }) => ({
      order: orderId,
      taskDefinition: def._id,
      assignee,
      title: def.title,
      dueDate,
      status: 'pending',
    }));

  const session = await mongoose.startSession();
  let order;
  let tasks;

  try {
    await session.withTransaction(async () => {
      const [created] = await Order.create(
        [
          {
            orderType,
            orderedByName: String(orderedByName).trim(),
            orderDate: anchor,
            createdBy: createdById,
          },
        ],
        { session }
      );
      order = created;
      tasks = await OrderTask.insertMany(buildTaskDocs(order._id), { session });
    });
  } catch (err) {
    if (!isTransactionUnsupportedError(err)) {
      throw err;
    }
    order = await Order.create({
      orderType,
      orderedByName: String(orderedByName).trim(),
      orderDate: anchor,
      createdBy: createdById,
    });
    tasks = await OrderTask.insertMany(buildTaskDocs(order._id));
  } finally {
    await session.endSession();
  }

  return { order, tasks };
}
