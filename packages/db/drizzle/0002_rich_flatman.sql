CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "platform_settings" ("id", "contact_email", "contact_phone")
VALUES ('singleton', '', '')
ON CONFLICT ("id") DO NOTHING;
