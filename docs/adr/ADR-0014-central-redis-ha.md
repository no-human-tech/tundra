# ADR-0014: Central Redis HA consumed through Sentinel

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Tundra uses Redis for the BullMQ job queue and (since the HA hardening) for
cross-replica single-use OAuth/OIDC nonce consumption. The production cluster
provides a central Redis HA service — one master, two replicas, Sentinel
quorum — while local development runs a single Redis from Docker Compose. An
app-local Redis per deployment would duplicate state management and leave
failover unsolved.

## Decision

Production consumes the **central Redis through Sentinel**: when
`REDIS_SENTINEL_ADDRS` is set, `redisConnectionOptions` (in `@tundra/config`,
pure data) yields Sentinel connection options (`sentinels`, master-set `name`,
password) that both ioredis (API) and BullMQ (worker) accept, so master
failover is handled client-side with no app restarts. Without Sentinel
config, clients fall back to `REDIS_URL` (self-hosted/dev). No app-local
Redis ships in the production manifests.

## Consequences

- One Redis to operate, back up, and secure; Tundra follows its failovers
  automatically.
- Queue and nonce state survive the loss of a Redis node (replication +
  Sentinel promotion); in-flight commands during a failover may error once
  and are retried by BullMQ/ioredis.
- Dev/prod parity is config-only — the same code path, different envs.
- The API's readiness probe pings Redis, so pods stop receiving traffic
  during a full Redis outage instead of failing requests midway.
