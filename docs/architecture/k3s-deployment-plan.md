# k3s production deployment plan

Plan for deploying Tundra to production on the shared k3s cluster: application
pods highly available across the two worker nodes (`k3s-w1`/`k3s-w2`), central
Keycloak (`id.no-human.tech`, realm `no-human`, GitHub as identity provider),
central PostgreSQL (CNPG cluster `postgres-main`), central Redis HA
(Sentinel), and Redpanda as the integration bus for external systems. The
single app image is built and published to GHCR by GitHub Actions
(`.github/workflows/docker.yml` — ADR-0016/0017).

This document plans the **application-side** work. Cluster-side manifests live
in the separate infra repository (`kubernetes/apps/tundra`) and follow its
existing app conventions (namespace + ExternalSecrets + Traefik IngressRoute +
cert-manager certificate).

Related: [deployment-plan.md](deployment-plan.md) (Docker Swarm model, kept for
self-hosted single-node deployments), [auth-and-identity.md](auth-and-identity.md).

## Already HA-ready

These properties are in place today and are what the plan builds on:

- Server-side sessions in Postgres (SHA-256 token hash, scrypt password
  hashing) — no sticky sessions required.
- Stateless `api` and `worker`; the worker is decoupled from the API by the
  BullMQ queue.
- Production multi-stage Dockerfiles for all three services
  (`infra/docker/Dockerfile.{api,web,worker}`).
- Validated env configuration (`@tundra/config`, zod, fail-fast, hard error on
  `CORS_ORIGIN=*` outside development).
- Drizzle migrations committed in `packages/db/drizzle`.

## Phase 1 — Keycloak OIDC integration (blocker)

Production login goes exclusively through Keycloak; the platform brokers
GitHub. The existing OIDC client `tundra` in realm `no-human` (redirect
`https://tundra.no-human.tech/*`, client roles + groups already provisioned)
is the target.

- Add an OIDC client module to `apps/api` (Authorization Code + PKCE,
  confidential client) using a certified library (`openid-client`), discovery
  from `https://id.no-human.tech/realms/no-human`.
- Routes: `/auth/oidc/start`, `/auth/oidc/callback`, RP-initiated logout.
  The callback validates the ID token, maps claims (`sub`, `email`, `name`,
  client roles/groups) to an `ExternalIdentity` with
  `IdentityProviderKind.Oidc` (slug `oidc:keycloak`), links or creates the
  user, and issues the **existing DB-backed session cookie**. Keycloak is the
  IdP; Tundra sessions stay server-side in Postgres (no app-level JWT).
- Map Keycloak group/role claims (`organizacje/no-human/tundra/<role>`) to
  Tundra roles at login.
- Config (`@tundra/config`): `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`,
  `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URL`, plus an `oidc.enabled` feature
  gate mirroring `github.enabled`. Web gets `VITE_OIDC_ENABLED` to show the
  SSO tile.
- Direct GitHub OAuth and local registration remain **modules for self-hosted
  deployments**, disabled in this production profile (Keycloak already brokers
  GitHub). Record as an ADR.

## Phase 2 — HA hardening (blockers)

- **Migrations:** stop auto-migrating on API start in production. Introduce a
  dedicated migrate entrypoint (`pnpm --filter @tundra/db run db:migrate`) run
  as a Kubernetes Job before each rollout, and wrap `migrateToLatest` in a
  Postgres advisory lock as a second line of defence. Gate the current
  behaviour behind `RUN_MIGRATIONS_ON_START` (default `false` in production).
- **Readiness:** make `/ready` real — `SELECT 1` on the pg pool and a Redis
  `PING`; return 503 until both succeed. `/health` stays a static liveness
  endpoint. The worker gets an equivalent readiness signal (queue connection
  established).
- **Dev identity fallback:** hard-disable the `x-tundra-user-id` header path
  outside `NODE_ENV=development`.
- **OAuth/OIDC state:** move one-time state/nonce/PKCE storage from in-process
  memory to central Redis so single-use holds across replicas.
- **Graceful shutdown:** on SIGTERM close the HTTP server, drain the pg pool
  and BullMQ workers within the pod termination grace period.

## Phase 3 — Platform services wiring

- **PostgreSQL (central, CNPG `postgres-main`):** add a managed role and
  database `tundra` (same pattern as the existing `keycloak` database), with
  credentials in Vault and delivered via ExternalSecrets as `DATABASE_URL`
  (`sslmode=require`).
- **Redis (central, HA):** consume the cluster Redis via Sentinel — sentinel
  endpoint `redis.redis.svc.cluster.local:26379`, master set `redis-master`,
  password from Vault. Extend `@tundra/config` and the BullMQ/ioredis
  connection factory to accept a Sentinel configuration
  (`REDIS_SENTINEL_ADDRS`, `REDIS_SENTINEL_MASTER`, `REDIS_PASSWORD`) in
  addition to the current `REDIS_URL`, so failover is client-side automatic.
  No app-local Redis in production.
- **Redpanda (integration bus for external systems):** all integration with
  external systems flows through the central Redpanda (Kafka API, SASL
  SCRAM-SHA-512, in-cluster only):
  - Outbound: domain events (WorkItem lifecycle, audit events) are written to
    a transactional **outbox table** in the same Postgres transaction as the
    domain change; the worker relays the outbox to explicit Redpanda topics
    (e.g. `tundra.events.workitem`, replication factor 3 — topic auto-create
    is disabled cluster-wide, topics are provisioned explicitly).
  - Inbound: external systems publish to `tundra.integrations.inbound.*`; a
    worker consumer maps them onto the unified WorkItem model
    (extension-generated actions), which keeps My Tasks aggregation intact.
  - Client: a Kafka client with SCRAM-SHA-512 support (e.g. KafkaJS) behind a
    small `@tundra/modules-sdk` extension point, so integrations stay modular.
  - Credentials: dedicated SASL user + ACL scoped to `tundra.*` topics, stored
    in Vault, delivered via ExternalSecrets.
  - Record as an ADR (Redpanda as the integration bus; outbox pattern).

## Phase 4 — Kubernetes manifests (infra repo, `kubernetes/apps/tundra`)

- `00-namespace.yaml` — namespace `tundra`.
- `01-externalsecrets.yaml` — Vault → `DATABASE_URL`, Redis password, OIDC
  client secret (`keycloak/clients/tundra`), Redpanda SASL credentials, GHCR
  `imagePullSecret` (unless the packages are made public).
- `20-api-deployment.yaml` — 2 replicas, `podAntiAffinity` (required) across
  `k3s-w1`/`k3s-w2`, readiness `/ready`, liveness `/health`, resources,
  `TUNDRA_DATA_SOURCE=db`.
- `21-worker-deployment.yaml` — 1 replica initially (BullMQ concurrency is
  in-process; scale after load data), readiness from queue connection.
- `22-web-deployment.yaml` — 2 replicas (Node static server, ADR-0016),
  anti-affinity, rolling update `maxUnavailable: 0`.
- `25-migrate-job.yaml` — migration Job template (app image, migrate
  entrypoint), executed per release before rollout.
- `30-services.yaml`, `40-ingress.yaml` — Traefik IngressRoute for
  `tundra.no-human.tech`: `/graphql`, `/auth`, `/health`, `/ready` → api;
  everything else → web. Single host keeps the session cookie same-site
  (matches the `VITE_API_URL=https://tundra.no-human.tech/graphql` bake in the
  web image).
- `50-certificate.yaml` — cert-manager certificate (Let's Encrypt), same
  pattern as existing public apps.
- PodDisruptionBudgets (`minAvailable: 1`) for api and web.

## Phase 5 — Continuous deployment

Image publishing is automated (GitHub Actions → GHCR, ADR-0017). Rollout to
the cluster is currently the manual sequence from the infra repo README
(migration Job → `kubectl set image`/apply with the `sha-<commit>` tag →
`kubectl rollout status` → smoke test `https://tundra.no-human.tech`).
Automating it needs a deploy path that can reach the internal API server —
either a pull-based operator (Flux/Argo) or a self-hosted runner with the
namespace-scoped `tundra-deployer` ServiceAccount; decision deferred.

## Phase 6 — HA verification checklist

- Kill one api pod → traffic keeps flowing, session survives (cookie backed by
  Postgres).
- Rolling update with `maxUnavailable: 0` → zero-downtime deploy observed.
- Login via Keycloak end to end (GitHub → Keycloak → Tundra session), logout
  propagates (RP-initiated).
- Redis master failover (Sentinel) → worker reconnects, queue drains.
- Redpanda broker restart → outbox relay resumes without event loss
  (at-least-once, consumer idempotency verified).
- Migration Job race test: two simultaneous Job runs → advisory lock
  serializes them.

## Decisions to record (ADRs)

1. Keycloak as the sole production identity provider; direct GitHub OAuth and
   local registration remain opt-in modules for self-hosted installs.
2. Redpanda as the integration bus for external systems, with a transactional
   outbox; BullMQ/Redis stays the **internal** job queue.
3. Central Redis HA (Sentinel) consumed by the app; no app-local Redis in
   production.
4. Migrations run as a pre-rollout Job with an advisory lock, not on API
   startup.

## Open questions

- GHCR package visibility: public (source-available project) vs private +
  `imagePullSecret`.
- Worker scale-out policy once real queue/consumer load exists.
- Whether `web` should later read runtime config (e.g. `config.json` fetched
  at boot) instead of baking `VITE_*` at image build time, to reuse one image
  across environments.
