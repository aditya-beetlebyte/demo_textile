import mongoose from 'mongoose';
import { ORDER_TYPES } from './constants.js';

const taskDefinitionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    driLabel: { type: String, required: true, trim: true },
    offsetDays: { type: Number, required: true, min: 0 },
    sortOrder: { type: Number, required: true },
    dri: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    orderTypes: {
      type: [String],
      default: () => [...ORDER_TYPES],
      validate: {
        validator(arr) {
          return arr.every((t) => ORDER_TYPES.includes(t));
        },
        message: 'Invalid order type in orderTypes',
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

taskDefinitionSchema.index({ isActive: 1, sortOrder: 1 });
taskDefinitionSchema.index({ orderTypes: 1 });

export default mongoose.model('TaskDefinition', taskDefinitionSchema);
