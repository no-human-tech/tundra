# ADR-0012: Central OIDC identity provider for production

- **Status:** Accepted
- **Date:** 2026-07-14

## Context

Tundra has three auth paths: built-in email/password (register + login),
direct GitHub OAuth, and DB-backed server-side sessions shared by all of them
(ADR-0008, ADR-0010). The production deployment on the k3s cluster uses a
central Keycloak (`id.no-human.tech`, realm `no-human`) as the organization's
identity authority; Keycloak itself brokers GitHub as an upstream IdP and
carries workspace-role intent through the `organizacje/no-human/tundra/<role>`
groups, which grant the `tundra` client roles `user` and `admin`. Running
Tundra's own registration and its direct GitHub OAuth next to that would
create a second, unmanaged account population. At the same time Tundra is an
open-source product: self-hosted installs without a Keycloak must keep
working out of the box.

## Decision

Add an OIDC client (Authorization Code + PKCE via `openid-client`) as a
first-class login path, enabled by configuration (`OIDC_ISSUER_URL`,
`OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_REDIRECT_URL`):

- **Sessions stay server-side and DB-backed.** A successful callback resolves
  the user through `loginWithOidc` (subject match → verified-email link → new
  user, mirroring the GitHub flow) and issues the regular `tundra.session`
  cookie. The IdP is an authentication authority, not a session store; no
  app-level JWT sessions.
- **Login transaction state travels in a signed cookie.** State, nonce, and
  the PKCE verifier are carried in a short-lived, HMAC-signed, HTTP-only
  cookie (`tundra.oidc`), so any API replica can complete a login started by
  another — no in-memory state, no sticky sessions.
- **The IdP asserts the workspace role.** `resource_access.tundra.roles`
  (and/or group paths) map to Tundra roles: `admin` → workspace `admin`,
  everything else → `member`. The role is re-synced on every login, with two
  guards: `owner` is never touched and the last admin is never demoted.
- **Identity rows use `providerId: "oidc:keycloak"`** — the `oidc:<slug>`
  scheme reserved by ADR-0008.
- **Local auth and direct GitHub OAuth remain modules for self-hosted
  installs.** They stay enabled by default; the OIDC-only production profile
  sets `AUTH_LOCAL_ENABLED=false` (register/login answer 503) and simply does
  not configure GitHub credentials. Nothing is removed.

## Consequences

- Production logins flow GitHub → Keycloak → Tundra with one account
  population governed centrally (groups in Keycloak drive Tundra roles).
- Horizontal scaling of the API needs no shared state for logins; the signed
  transaction cookie plus DB sessions already work across replicas.
- Role assertions from the IdP override manual role changes for `admin`/
  `member` on next login — workspace admins manage roles in Keycloak, not in
  Tundra, when OIDC is on. `owner` remains Tundra-managed.
- Self-hosted deployments are unaffected; enabling OIDC is additive config.
- Keycloak puts client roles in the access token by default; the API reads
  them from the ID token when a mapper is configured and falls back to
  decoding the access token payload received directly from the token
  endpoint.
