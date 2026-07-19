# Architecture Decision Records

An Architecture Decision Record (ADR) captures a single significant architectural
decision: the context that forced it, the decision taken, and the consequences we
accept. ADRs are immutable history — rather than editing a decision, we add a new
ADR that supersedes it. Each record uses the same template (**Status**,
**Context**, **Decision**, **Consequences**) and is numbered sequentially. They
are the durable rationale behind the architecture documented in
[`docs/architecture`](../architecture/overview.md).

## Index

| ADR                                                            | Title                                                               | Status   |
| -------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| [ADR-0001](./ADR-0001-monorepo.md)                             | Monorepo with pnpm workspaces and Turborepo                         | Accepted |
| [ADR-0002](./ADR-0002-typescript-first.md)                     | TypeScript-first, strict everywhere                                 | Accepted |
| [ADR-0003](./ADR-0003-unified-work-item-model.md)              | Unified WorkItem model                                              | Accepted |
| [ADR-0004](./ADR-0004-project-scoped-navigation.md)            | Project-scoped navigation                                           | Accepted |
| [ADR-0005](./ADR-0005-module-system.md)                        | Module system and extension points                                  | Accepted |
| [ADR-0006](./ADR-0006-graphql-api-boundary.md)                 | GraphQL API boundary (Yoga on Hono, Drizzle)                        | Accepted |
| [ADR-0007](./ADR-0007-local-deployment-with-docker-compose.md) | Local deployment with Docker Compose                                | Accepted |
| [ADR-0008](./ADR-0008-auth-identity-foundation.md)             | Authentication & identity foundation                                | Accepted |
| [ADR-0009](./ADR-0009-audit-and-reversible-actions.md)         | Audit trail & reversible actions                                    | Accepted |
| [ADR-0010](./ADR-0010-persistence-and-dev-session.md)          | Persistence backend, dev session & first reversible action          | Accepted |
| [ADR-0011](./ADR-0011-internationalization.md)                 | Internationalization of the web app                                 | Accepted |
| [ADR-0012](./ADR-0012-central-oidc-identity-provider.md)       | Central OIDC identity provider for production                       | Accepted |
| [ADR-0013](./ADR-0013-redpanda-integration-bus.md)             | Redpanda integration bus with a transactional outbox                | Accepted |
| [ADR-0014](./ADR-0014-central-redis-ha.md)                     | Central Redis HA consumed through Sentinel                          | Accepted |
| [ADR-0015](./ADR-0015-migrations-as-pre-rollout-job.md)        | Migrations as a pre-rollout Job with an advisory lock               | Accepted |
| [ADR-0016](./ADR-0016-single-app-image.md)                     | Single application image with Node-served frontend                  | Accepted |
| [ADR-0017](./ADR-0017-github-actions-image-publishing.md)      | Image publishing on GitHub Actions, Jenkins retired                 | Accepted |
| [ADR-0018](./ADR-0018-multi-tenant-login.md)                   | Multi-tenant login via tenant subdomains and Keycloak Organizations | Accepted |
