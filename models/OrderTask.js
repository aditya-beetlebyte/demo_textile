import mongoose from 'mongoose';
import { TASK_STATUSES } from './constants.js';

const orderTaskSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    taskDefinition: { type: mongoose.Schema.Types.ObjectId, ref: 'TaskDefinition', default: null },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    title: { type: String, required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: TASK_STATUSES, default: 'pending' },
    comment: { type: String, default: '' },
    photoUrl: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    updates: [
      {
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
        actorRole: { type: String, enum: ['admin', 'dri'], required: true },
        note: { type: String, default: '' },
        imageUrl: { type: String, default: '' },
        statusFrom: { type: String, enum: TASK_STATUSES },
        statusTo: { type: String, enum: TASK_STATUSES },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

orderTaskSchema.index({ assignee: 1, dueDate: 1 });
orderTaskSchema.index({ order: 1, dueDate: 1 });
orderTaskSchema.index({ dueDate: 1 });
orderTaskSchema.index({ status: 1, assignee: 1 });

export default mongoose.model('OrderTask', orderTaskSchema);
