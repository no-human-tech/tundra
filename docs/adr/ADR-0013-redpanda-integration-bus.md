# ADR-0013: Redpanda integration bus with a transactional outbox

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Tundra must exchange events with external systems (integrations, other
products in the organization) without coupling the API's request path to any
of them. The production cluster runs a central Kafka-compatible Redpanda
(SASL/SCRAM-SHA-512, explicit topic provisioning, in-cluster only). Direct
produce-from-request would lose events on broker outages and add tail latency
to user actions; ad-hoc HTTP webhooks would re-invent delivery, ordering, and
retry per integration. Internally the worker already consumes a BullMQ/Redis
queue for jobs — that queue is not an integration surface.

## Decision

All integration with external systems flows through Redpanda, decoupled from
the request path by a **transactional outbox**:

- **Outbound:** every audit event (the audit log IS the domain-event stream,
  ADR-0009) also enqueues a row in `integration_outbox` (topic, key, payload).
  The worker relays unpublished rows in order to `tundra.events.workitem`
  (WorkItem targets) and `tundra.events.audit` (everything else), stamping
  `published_at` after the broker confirms. Delivery is **at-least-once**;
  messages carry the outbox row id so consumers deduplicate.
- **Inbound:** external systems publish to `tundra.integrations.inbound.*`.
  The worker validates each message against the `@tundra/modules-sdk`
  contract (`parseInboundMessage`) and upserts it into the unified WorkItem
  model as an `extension`-sourced item with id derived from
  `(moduleId, externalId)` — idempotent, and it surfaces in My Tasks like
  every other source (ADR-0003).
- **The message contract lives in `@tundra/modules-sdk`** (pure types +
  validation), so integrations are modules in spirit: the host owns the seam,
  integrations own their topics.
- **BullMQ/Redis stays the internal job queue.** Redpanda is for crossing the
  system boundary; the queue is for Tundra's own background work.
- The bus is **optional config** (`REDPANDA_*`): self-hosted installs without
  Redpanda run queue-only; outbox rows are still written (identical write
  path) but no relay runs.

## Consequences

- External delivery survives broker and worker outages: rows wait in Postgres
  and the relay resumes where it left off (`attempts`/`last_error` recorded).
- Consumers must tolerate duplicates (at-least-once) — the row id enables
  exactly-once effects downstream.
- Topics are provisioned explicitly (cluster policy: no auto-create,
  replication factor 3) and ACL-scoped to the `tundra.` prefix.
- Outbox rows currently share the flow, not a single SQL transaction, with
  the domain write (matching the existing audit-write pattern); moving both
  into one transaction is a follow-up if partial-write gaps ever matter.
- A relay lag metric (oldest unpublished row age) is the natural first alert.
