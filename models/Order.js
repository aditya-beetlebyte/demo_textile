import mongoose from 'mongoose';
import { ORDER_TYPES } from './constants.js';
import OrderTask from './OrderTask.js';

const orderSchema = new mongoose.Schema(
  {
    orderType: { type: String, required: true, enum: ORDER_TYPES },
    orderedByName: { type: String, required: true, trim: true },
    orderDate: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  },
  { timestamps: true }
);

// Cascade delete: when an Order is deleted, remove all linked OrderTask docs too.
orderSchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    await OrderTask.deleteMany({ order: doc._id });
  }
});

orderSchema.post('findByIdAndDelete', async function (doc) {
  if (doc) {
    await OrderTask.deleteMany({ order: doc._id });
  }
});

orderSchema.index({ orderType: 1, orderDate: 1 });
orderSchema.index({ orderedByName: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model('Order', orderSchema);
