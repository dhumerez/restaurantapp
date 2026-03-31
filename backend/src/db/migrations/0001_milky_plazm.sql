CREATE TABLE "superadmins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "superadmins_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;