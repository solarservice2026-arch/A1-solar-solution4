import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });

const uri = process.env.MONGODB_URI;

async function check() {
  if (!uri) {
    console.log('No MONGODB_URI found in env');
    return;
  }
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  const targetId = '6aa6fc345910e60f4c779b8b';
  const { ObjectId } = await import('mongodb');

  for (const c of collections) {
    const name = c.name;
    const doc = await db.collection(name).findOne({
      $or: [
        { _id: new ObjectId(targetId) },
        { _id: targetId }
      ]
    });
    if (doc) {
      console.log('FOUND IN COLLECTION:', name);
      console.log('DOC:', JSON.stringify(doc, null, 2));
    }
  }
  await mongoose.disconnect();
}

check().catch(console.error);
