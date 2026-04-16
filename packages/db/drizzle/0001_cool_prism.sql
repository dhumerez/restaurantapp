ALTER TABLE "menu_items" ADD COLUMN IF NOT EXISTS "stock" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean DEFAULT false NOT NULL;