import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // App URL used for email links
  APP_URL: z.string().default("http://localhost:5173"),
  // Resend API key for transactional email (optional — registration emails disabled if not set)
  RESEND_API_KEY: z.string().optional(),
  // R2 / S3-compatible storage (optional — image upload disabled if not set)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
