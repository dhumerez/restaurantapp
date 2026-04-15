import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema.js";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb(connectionString: string) {
  if (_db) return _db;
  const pool = new Pool({ connectionString });
  _db = drizzle(pool, { schema });
  return _db;
}

export type Db = ReturnType<typeof getDb>;
