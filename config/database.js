import mongoose from 'mongoose';

export async function connectDatabase() {
  const uri = process.env.MONGO_URL;
  if (!uri) {
    throw new Error('MONGO_URL is not set');
  }
  if (process.env.MONGODB_IPV4 === '1') {
    mongoose.set('family', 4);
  }
  await mongoose.connect(uri);
}
