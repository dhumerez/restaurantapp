import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { anonymous } from "better-auth/plugins";
import { db } from "./db.js";
import { env } from "../config/env.js";
import * as schema from "@restaurant/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: { enabled: true },
  socialProviders: env.GOOGLE_CLIENT_ID
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  plugins: [anonymous()],
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: null },
      restaurantId: { type: "string", required: false, defaultValue: null },
      isActive: { type: "boolean", required: true, defaultValue: true },
    },
  },
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: {
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  trustedOrigins: [env.CORS_ORIGIN],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user & {
  role: "superadmin" | "admin" | "waiter" | "kitchen" | "cashier" | null;
  restaurantId: string | null;
  isActive: boolean;
};
