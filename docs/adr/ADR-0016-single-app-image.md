# ADR-0016: Single application image with Node-served frontend

- **Status:** Accepted
- **Date:** 2026-07-16

## Context

The first production deployment shipped three container images
(`tundra/api`, `tundra/worker`, `tundra/web`). The api and worker images were
byte-for-byte identical except for their `CMD` (the whole pnpm workspace runs
from TypeScript source via `tsx`), while the web image was a different stack
entirely: static Vite output served by nginx.

Operating three packages surfaced real costs during the rollout:

- GHCR treats every image name as a separate package. GitHub App installation
  tokens cannot _create_ packages, so every new image name requires a one-time
  manual PAT push plus per-package visibility and access configuration.
- The api/worker images already deduplicated at the layer level — pushing the
  worker after the api uploaded a single layer. Three names bought no isolation,
  only triple metadata.
- nginx was the only non-Node runtime in the stack, with its own config
  format, base-image update cadence and security surface.

## Decision

Build **one image** — `ghcr.io/no-human-tech/tundra/app`
(`infra/docker/Dockerfile.app`) — and select the role at run time via
`command`:

| Role   | Command                                 |
| ------ | --------------------------------------- |
| api    | `pnpm --filter @tundra/api start` (CMD) |
| worker | `pnpm --filter @tundra/worker start`    |
| web    | `pnpm --filter @tundra/web run serve`   |

The frontend is served by Node instead of nginx: `apps/web/server.ts` is a
dependency-free `node:http` static server (SPA fallback, immutable caching for
hashed `/assets/*`, path-traversal guard, SIGTERM drain) run through `tsx`,
listening on `:8080`. Vite build args (`VITE_*`) are baked into the image at
build time exactly as before.

Kubernetes deployments, the CD pipeline and docker-compose all reference the
single image; api/worker/web remain **separate Deployments** with their own
replica counts, probes and PodDisruptionBudgets — consolidation applies to the
artifact, not the topology.

## Consequences

- One GHCR package: one-time creation, one visibility setting, and GitHub App
  tokens can push every subsequent build.
- Every layer is shared by all three roles; a release ships exactly one image
  digest, so api/worker/web can never run mismatched builds within a release.
- The whole stack is Node.js — one runtime to patch, profile and reason about.
- The web pods now carry the full workspace (~790 MB vs ~97 MB with nginx).
  The kubelet stores the image once per node, and api pods already required
  it, so the practical cost on the current topology is negligible.
- Static serving moves from nginx (C, battle-tested) to ~100 lines of our own
  TypeScript; the server is deliberately minimal and Traefik still terminates
  TLS, applies security headers and rate limits in front of it.
