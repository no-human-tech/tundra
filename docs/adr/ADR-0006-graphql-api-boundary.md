# ADR-0006: GraphQL API boundary (Yoga on Hono, Drizzle)

- **Status:** Accepted
- **Date:** 2026-06-27

## Context

The web shell needs a single, typed contract to the backend, and the backend needs
one well-defined public surface. "My Tasks" alone aggregates many sources into one
shaped view, and the frontend benefits from selecting exactly the fields it needs;
this is a natural fit for a query language rather than a sprawl of REST endpoints.
We also need an HTTP server to host that boundary, and a type-safe way to talk to
PostgreSQL that maps cleanly onto the `@tundra/domain` shapes without a heavy ORM.
The stack direction (GraphQL, a lightweight server, Drizzle) was already chosen;
this ADR records the concrete picks and the boundary rules.

## Decision

Adopt **GraphQL as the single public API boundary**, served by **GraphQL Yoga**.
Host it on **Hono** rather than Fastify: Hono is lighter, exposes first-class
Web-standard `Request`/`Response` objects that pair directly with Yoga's
`fetch`-based handler (`app.all("/graphql", c => yoga.fetch(c.req.raw))`), and is
runtime-portable, which supports the "no vendor lock-in" principle. The server
stays thin because GraphQL — not REST plugins — does the heavy lifting; a plain
`GET /health` liveness route rounds it out. The GraphQL enums mirror the domain
enums exactly. Confirm **Drizzle** (over `node-postgres`) as the type-safe SQL
layer in `@tundra/db`: it gives compile-time-checked SQL with a minimal runtime and
maps cleanly to the domain types, with Postgres enums sourced from the domain enums.
The API is the only public surface; the worker has none.

## Consequences

- The frontend has one typed contract and can request exactly the fields it needs;
  "My Tasks" is a single `myTasks` query over the read model, using the canonical
  `selectMyTasks` so the API and domain agree by construction.
- Hono keeps the server layer minimal and portable; swapping the host runtime later
  is low-cost because the boundary is Web-standard `fetch`.
- Drizzle keeps SQL type-checked and the runtime light, and the database can never
  drift from the domain enum contract.
- A single GraphQL endpoint concentrates concerns like authorization, rate
  limiting, and validation at one boundary — convenient, but it must be guarded
  carefully as those concerns are added (the `PermissionHook` seam exists for this).
