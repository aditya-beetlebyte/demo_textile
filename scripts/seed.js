import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import Employee from '../models/Employee.js';
import TaskDefinition from '../models/TaskDefinition.js';
import { DEFAULT_TASK_DEFINITIONS } from '../data/taskDefinitions.seed.js';
import { ORDER_TYPES } from '../models/constants.js';

const ADMIN_EMAIL = 'admin@textile.com';
const ADMIN_PASSWORD = 'demo@admin123';

const DRI_NAMES = [...new Set(DEFAULT_TASK_DEFINITIONS.map((t) => t.driLabel))];

function slugForName(name) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'user';
}

function emailForName(name) {
  return `${slugForName(name)}@textile.com`;
}

function passwordForName(name) {
  return `${slugForName(name)}@123`;
}

async function seed() {
  await connectDatabase();

  for (const name of DRI_NAMES) {
    const email = emailForName(name);
    const passwordHash = await bcrypt.hash(passwordForName(name), 10);
    await Employee.findOneAndUpdate(
      { email },
      {
        $set: {
          name,
          email,
          passwordHash,
          role: 'dri',
          isActive: true,
        },
      },
      { upsert: true }
    );
  }

  const adminPasswordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await Employee.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    {
      $set: {
        name: 'Admin',
        email: ADMIN_EMAIL,
        passwordHash: adminPasswordHash,
        role: 'admin',
        isActive: true,
      },
    },
    { upsert: true }
  );

  for (let i = 0; i < DEFAULT_TASK_DEFINITIONS.length; i++) {
    const row = DEFAULT_TASK_DEFINITIONS[i];
    await TaskDefinition.findOneAndUpdate(
      { sortOrder: i },
      {
        $set: {
          title: row.title,
          driLabel: row.driLabel,
          offsetDays: row.offsetDays,
          sortOrder: i,
          orderTypes: [...ORDER_TYPES],
          isActive: true,
          dri: null,
        },
      },
      { upsert: true }
    );
  }

  const employees = await Employee.find({ role: 'dri' }).lean();
  const byName = new Map(employees.map((e) => [e.name, e._id]));

  const defs = await TaskDefinition.find({}).sort({ sortOrder: 1 });
  for (const def of defs) {
    const id = byName.get(def.driLabel);
    if (id) {
      def.dri = id;
      await def.save();
    }
  }

  console.log('Seed complete.');
  console.log(`Admin login: ${ADMIN_EMAIL}`);
  console.log(`Admin password: ${ADMIN_PASSWORD}`);
  console.log('DRI logins: <name>@textile.com (name slug), password: <name>@123 (e.g. madhu@123)');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
