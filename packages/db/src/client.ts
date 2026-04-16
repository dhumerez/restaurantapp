import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

export type Db = NodePgDatabase<typeof schema>;

let _db: Db | null = null;

export function getDb(connectionString: string): Db {
  if (_db) return _db;
  const pool = new Pool({ connectionString });
  _db = drizzle(pool, { schema });
  return _db;
}
