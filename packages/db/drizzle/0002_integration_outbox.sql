-- Migration 0002: integration outbox
-- Transactional outbox for the integration bus (Redpanda): domain writes
-- enqueue rows here; the worker relays unpublished rows to Kafka topics and
-- stamps published_at (at-least-once, consumers keyed by id).
--
-- NOTE: the generated diff also wanted to re-create "sessions" and the
-- external_identities.credential_hash column because migration 0001 was
-- hand-written without a snapshot; those statements are intentionally
-- omitted here (0001 already applied them) and the 0002 snapshot now
-- carries the full schema, so future diffs are clean.

CREATE TABLE "integration_outbox" (
  "id" text PRIMARY KEY NOT NULL,
  "topic" text NOT NULL,
  "key" text,
  "payload" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "published_at" timestamp with time zone,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text
);--> statement-breakpoint

CREATE INDEX "integration_outbox_pending_idx"
  ON "integration_outbox" USING btree ("published_at", "created_at");
