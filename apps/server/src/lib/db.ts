import { getDb } from "@restaurant/db";
import { env } from "../config/env.js";

export const db = getDb(env.DATABASE_URL);
