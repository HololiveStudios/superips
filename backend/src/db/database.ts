import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = `postgresql://superips_user:359628@10.0.11.150:5432/superips_db`;

const queryClient = postgres(connectionString);
export const db = drizzle(queryClient, { schema });