import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { env } from '../../src/config/env';

let mongod: MongoMemoryServer | null = null;

/**
 * Connect to a real MongoDB for tests.
 * Uses MONGODB_URI if set (e.g. a local/Atlas instance); otherwise spins up an
 * ephemeral real mongod binary via mongodb-memory-server (not an in-memory fake).
 */
export async function connectTestDb(): Promise<void> {
    mongod = await MongoMemoryServer.create();
  const uri2 = mongod.getUri();
  await mongoose.connect(uri2);
}

export async function disconnectTestDb(): Promise<void> {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}

export async function clearDatabase(): Promise<void> {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
}

