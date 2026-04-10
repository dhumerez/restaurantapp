-- Migration: Add self-registration support
--
-- Changes:
-- 1. Add is_email_verified to users (default true for existing pre-created users)
-- 2. Make restaurant_id nullable (self-registered users have no restaurant yet)
-- 3. Make role nullable (self-registered users have no role yet)
-- 4. Add partial unique index for pending users (email unique where restaurant_id IS NULL)
-- 5. Add verification_tokens table

-- Step 1: Add is_email_verified — default TRUE so existing users are not affected
ALTER TABLE "users" ADD COLUMN "is_email_verified" boolean NOT NULL DEFAULT true;
-- Change default to false for future self-registrations
ALTER TABLE "users" ALTER COLUMN "is_email_verified" SET DEFAULT false;

-- Step 2: Make restaurant_id nullable (existing NOT NULL constraint removed)
ALTER TABLE "users" ALTER COLUMN "restaurant_id" DROP NOT NULL;

-- Step 3: Make role nullable
ALTER TABLE "users" ALTER COLUMN "role" DROP NOT NULL;

-- Step 4: Partial unique index — emails must be unique among pending (restaurant-less) users
CREATE UNIQUE INDEX "users_pending_email_unique" ON "users" ("email") WHERE "restaurant_id" IS NULL;

-- Step 5: Verification tokens table
CREATE TABLE "verification_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" varchar(255) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
