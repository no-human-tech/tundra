-- Migration 0001: auth sessions + credential_hash
-- Adds password credential storage for the email provider and a server-side
-- session table.  Sessions store only the SHA-256 hash of the raw cookie token
-- so a stolen DB row cannot be directly replayed.

ALTER TABLE "external_identities"
  ADD COLUMN "credential_hash" text;--> statement-breakpoint

CREATE TABLE "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "token_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "invalidated_at" timestamp with time zone,
  CONSTRAINT "sessions_token_hash_uniq" UNIQUE("token_hash")
);--> statement-breakpoint

ALTER TABLE "sessions"
  ADD CONSTRAINT "sessions_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
  ON DELETE no action ON UPDATE no action;
