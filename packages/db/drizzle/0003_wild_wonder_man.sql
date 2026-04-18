ALTER TABLE "restaurants" ADD COLUMN "subscription_tier" text DEFAULT 'free' NOT NULL;
UPDATE "restaurants" SET "subscription_tier" = 'allaccess' WHERE slug = 'demo';