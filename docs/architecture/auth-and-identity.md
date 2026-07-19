# Authentication & Identity

This document defines Tundra's **users, identity, authentication sources, roles,
permissions, and the session authorization context**. Like everything else, the
canonical shapes live in `@tundra/domain` (`packages/domain/src`): pure type
declarations and pure functions, no I/O, no framework, no crypto. The API, the
worker, the db, and modules are all expressed in these terms.

This phase is **design plus pure domain helpers only**. Real session and token
issuance, live identity-provider integrations, and security hardening are
explicitly deferred — see [Deferred work](#deferred-work). The point of landing
the model now is so that the rest of the system (the `PermissionHook` seam, the
GraphQL boundary, the audit trail) can be written against a stable authorization
contract before any of it is wired to a real identity provider.

See [domain-model.md](./domain-model.md) for the shared conventions (branded ids,
`ISODateString`, `Entity<TId>`), [module-system.md](./module-system.md) for the
`PermissionHook` extension point this context flows into,
[audit-and-reversibility.md](./audit-and-reversibility.md) for accountability and
undo, and [ADR-0008](../adr/ADR-0008-auth-identity-foundation.md) for the
decision rationale.

---

## Where users sit in the model

The existing model already references `UserId` throughout — `Workspace.ownerId`,
`ProjectMember.userId`, `WorkItem.assigneeId`, `TimeEntry.userId`, and so on. What
was missing was the `User` entity itself, the identities that authenticate a user,
and the workspace-level membership that complements project-level `ProjectMember`.
This document fills exactly those gaps and nothing more.

```
ExternalIdentity --(userId)--> User <--(userId)-- WorkspaceMembership --(workspaceId)--> Workspace
       |                                                  |
   (providerId)                                       (role: WorkspaceRole)
       v
 IdentityProvider (stub config)                     ProjectMember (already exists, project-scoped)
```

---

## Identity providers

An **`IdentityProvider`** is host-level configuration describing one way a user
can authenticate. It is deliberately a plain config record, not a persisted
`Entity`: its `id` is a **stable string key**, not a generated branded id.

```ts
export enum IdentityProviderKind {
	Email = "email",
	OAuth = "oauth",
	Oidc = "oidc",
	Saml = "saml",
}

export interface IdentityProvider {
	/** Stable key: "email", "github", "gitlab", "oidc:<slug>". */
	id: string;
	kind: IdentityProviderKind;
	displayName: string;
	/** Issuer URL for OIDC/SAML providers; absent for email. */
	issuer?: string;
	enabled: boolean;
}
```

The `id` is the stable join key that `ExternalIdentity.providerId` points at. The
reserved keys for this phase are:

| `id`          | `kind`  | Meaning                                                 |
| ------------- | ------- | ------------------------------------------------------- |
| `email`       | `Email` | Email + password (or magic link) registration / login.  |
| `github`      | `OAuth` | GitHub OAuth.                                           |
| `gitlab`      | `OAuth` | GitLab OAuth.                                           |
| `oidc:<slug>` | `Oidc`  | A workspace/enterprise OIDC provider, one per `<slug>`. |

**SAML is part of the enum and the type but is documented as planned, not
implemented.** Modeling the kind now keeps the contract forward-compatible without
committing to a SAML integration in this phase.

Provider records are **stub/mock metadata only**: `displayName`, `issuer`,
`enabled`. They carry **no client secrets, tokens, or keys**. Real provider
secrets are supplied at runtime through environment variables validated by
`@tundra/config` (the `.env.example` convention, see
[Security baseline](#security-baseline)), never stored in a provider record and
never committed.

---

## Users

A **`User`** is the human (or service) account that authenticates and is assigned
work.

```ts
export enum UserStatus {
	Active = "active",
	Invited = "invited",
	Suspended = "suspended",
	Deactivated = "deactivated",
}

export interface User extends Entity<UserId> {
	primaryEmail: string;
	emailVerified: boolean;
	displayName: string;
	status: UserStatus;
}
```

- `primaryEmail` is stored **normalized** (see [Linking invariants](#linking-invariants-and-helpers)).
- `status` gates access: only `Active` users authenticate normally; `Invited`
  users exist before first sign-in; `Suspended` and `Deactivated` users cannot
  obtain a usable session. Status is an authorization input, not just a display
  flag.
- The `Entity<UserId>` base gives every user `createdAt` / `updatedAt`.

---

## External identities

A **`ExternalIdentity`** links a `User` to a specific provider account. A single
user may have several (email plus GitHub plus an OIDC account, for example), which
is how account linking works.

```ts
export interface ExternalIdentity extends Entity<ExternalIdentityId> {
	userId: UserId;
	/** Matches an IdentityProvider.id, e.g. "email", "github", "oidc:acme". */
	providerId: string;
	/** The provider's stable subject (OAuth/OIDC `sub`). For email, the normalized address. */
	subject: string;
	email?: string;
	emailVerified: boolean;
	linkedAt: ISODateString;
}
```

`subject` is the **provider's stable subject** — the OAuth/OIDC `sub` claim, or the
normalized email address for the `email` provider. It is intentionally separate
from `email` because email addresses change while a provider subject does not; the
subject is the durable anchor for the identity.

### Linking invariants and helpers

Two invariants keep account linking unambiguous. Both are enforced by pure
helpers in `@tundra/domain` so the API can apply them before persisting and tests
can assert them directly.

1. **`(providerId, subject)` maps to at most one user.** No two identities may
   share the same provider subject. This is the rule that makes "sign in with
   GitHub" deterministically resolve to a single account.

2. **Emails are normalized.** All email comparison and storage goes through
   `normalizeEmail` (lowercase + trim), so an email identity is never duplicated
   inconsistently across providers (`Ada@Example.com` and `ada@example.com` are
   the same identity).

```ts
/** Lowercase + trim; the single canonical form for all email comparison/storage. */
export function normalizeEmail(email: string): string;

/** Stable composite key for an identity: combines providerId and subject. */
export function identityKey(providerId: string, subject: string): string;

/**
 * Returns a conflict reason if `candidate` cannot be linked given `existing`
 * identities (e.g. the (providerId, subject) pair already belongs to another
 * user), or null when linking is safe.
 */
export function findIdentityConflict(
	existing: readonly ExternalIdentity[],
	candidate: ExternalIdentity,
): string | null;
```

`identityKey(providerId, subject)` produces the composite key the API uses to look
up an existing identity; `findIdentityConflict` is the guard the API calls before
linking a new identity to a user. They are pure and deterministic, which is why
the linking rules can be enforced and tested at the lowest, most stable layer.

---

## Authentication sources

The model accounts for these sources today, even though none are integrated in
this phase:

- **Email registration / login** — the `email` provider; `subject` is the
  normalized address.
- **OAuth / OIDC for GitHub and GitLab** — the `github` and `gitlab` providers, at
  minimum. The provider's `sub` becomes the identity `subject`.
- **Workspace / enterprise SSO via OIDC first** — `oidc:<slug>` providers, one per
  configured issuer. OIDC is the first-class SSO path.
- **SAML — documented as planned, not implemented.** The `IdentityProviderKind.Saml`
  value reserves the shape so SSO can grow a SAML path later without a model break.

All provider metadata used in this phase is **mock/stub**. Real
authorization-code flows, token exchange, signature verification, and session
issuance are deferred (see [Deferred work](#deferred-work)).

---

## Roles and permissions

Tundra has two role scopes that compose: **workspace** and **project**.

### Workspace roles

`ProjectRole` (`owner | admin | member | viewer`) already exists for the
project scope. This phase adds the workspace scope:

```ts
export enum WorkspaceRole {
	Owner = "owner",
	Admin = "admin",
	Member = "member",
	Guest = "guest",
}

export interface WorkspaceMembership extends Entity<WorkspaceMembershipId> {
	workspaceId: WorkspaceId;
	userId: UserId;
	role: WorkspaceRole;
	joinedAt: ISODateString;
}
```

`WorkspaceMembership` is the workspace-level counterpart to the existing
`ProjectMember`. A user's effective authority is the **composition** of their
workspace role and their per-project roles:

- `WorkspaceMembership` answers "what may this user do across the workspace"
  (manage members, configure modules, read the audit log, revert others'
  actions).
- `ProjectMember` answers "what may this user do inside this specific project".

The two are deliberately separate entities with separate ids, mirroring the
global/project navigation separation: workspace concerns never collapse into a
project membership row or vice versa.

### Permissions

A permission is just a string. Keeping it a `type` (not an enum) lets modules
introduce their own permission strings through their manifest's `permissions`
without a core change.

```ts
/** A capability string, e.g. "workitem:update", "audit:read". */
export type Permission = string;
```

Conventional core permission strings include:

| Permission         | Meaning                                                  |
| ------------------ | -------------------------------------------------------- |
| `workitem:update`  | Modify a work item.                                      |
| `audit:read`       | Read the audit log ("who did what and when").            |
| `audit:revert`     | Revert your **own** reversible actions.                  |
| `audit:revert:any` | Revert **others'** permitted reversible actions (admin). |

The split between `audit:revert` (own) and `audit:revert:any` (others) is the
authorization spine of reversible actions — see
[audit-and-reversibility.md](./audit-and-reversibility.md).

Roles map to permissions through **pure resolvers**, so the mapping is one
testable function per scope and never drifts between layers:

```ts
export function permissionsForWorkspaceRole(role: WorkspaceRole): readonly Permission[];
export function permissionsForProjectRole(role: ProjectRole): readonly Permission[];
```

Higher roles are supersets of lower ones (e.g. `Owner` ⊇ `Admin` ⊇ `Member`),
and `Guest` / `viewer` are read-leaning. The resolvers are the single source of
truth for "which permissions does this role grant"; nothing else hard-codes a
role-to-permission mapping.

---

## The session principal (authorization context)

The **`SessionPrincipal`** is the resolved authorization context for a single
request. It is what the API places in scope after (eventually) validating a
session, and it is what flows into permission checks and into the `PermissionHook`
extension point.

```ts
export interface SessionPrincipal {
	/** Absent for anonymous/unauthenticated requests. */
	userId?: UserId;
	/** Where the action originates (user / automation / extension / system). */
	source: ActionSource;
	workspaceId?: WorkspaceId;
	workspaceRole?: WorkspaceRole;
	/** Resolved per-project role, keyed by project id. */
	projectRoles?: Record<string, ProjectRole>;
	/** The flattened, effective permission set for this request. */
	permissions: readonly Permission[];
	/** Deployment super-admin escape hatch; bypasses normal role checks. */
	isSuperAdmin?: boolean;
}
```

- `source` reuses the `ActionSource` enum from
  [audit-and-reversibility.md](./audit-and-reversibility.md), so the same notion of
  "who/what is acting" describes both the live request and the recorded audit
  event. A `user` request, an `automation` run, an `extension` action, and a
  `system` task all carry a principal.
- `permissions` is the already-resolved effective set (the union of what the
  workspace and project roles grant). Consumers check it directly rather than
  re-deriving from roles on every call.

Two pure helpers read the principal:

```ts
export function hasPermission(principal: SessionPrincipal, permission: Permission): boolean;
export function isWorkspaceAdmin(principal: SessionPrincipal): boolean;
```

- `hasPermission` honours `isSuperAdmin` (a super-admin has every permission) and
  otherwise tests membership in `principal.permissions`.
- `isWorkspaceAdmin` is true for `WorkspaceRole.Owner` / `WorkspaceRole.Admin` (or
  a super-admin). It is the predicate the revert authorization split keys on.

This is the **API authorization context**. Constructing it from a real validated
session or JWT is deferred; for now it is built directly (from mock data, fixtures,
or tests) — see [Dev session (current implementation)](#dev-session-current-implementation).
The contract — what a principal contains and how it is queried — is what we are
committing to here.

---

## Dev session (current implementation)

Real session and token issuance are deferred (see [Deferred work](#deferred-work)),
but the API still needs an acting principal on every request. Until auth lands, the
acting user is taken from a **dev request header**:

- **Header:** `x-tundra-user-id`. **Default:** `user-ada` when the header is
  absent. The API allow-lists this header in its CORS configuration so the browser
  web app can send it cross-origin.
- The API's per-request context factory reads the header and resolves a
  `SessionPrincipal`, then hands it to the resolvers. How the principal is resolved
  depends on the data source (`TUNDRA_DATA_SOURCE`):
  - **`mock` mode** — a fixture principal is built in-process: Ada →
    `WorkspaceRole.Admin`, Bob → `WorkspaceRole.Member` (others fall back to
    `Member`), composing `permissionsForWorkspaceRole` with the per-project
    `permissionsForProjectRole` exactly as db mode does, so authorization is
    identical across backends.
  - **`db` mode** — `loadSessionPrincipal` reads the user's `WorkspaceMembership`
    and `ProjectMember` rows from Postgres and builds the same effective principal.
  - If a header names a user the db does not know, the factory falls back to the
    mock principal builder.
- `source` on the resulting principal is `ActionSource.User`.

The web app sends the same header (default `user-ada`, overridable via
`VITE_DEV_USER_ID`). This is a **deliberate, clearly-bounded stand-in**, not a
security boundary — anyone who can reach the API can name any user. When real auth
lands, **only the context factory's header path is replaced** with session/token
validation; every resolver already consumes a resolved `SessionPrincipal`, so
nothing downstream changes.

---

## How this composes with the rest of the system

### With `WorkspaceMembership` and `ProjectMember`

The principal's `workspaceRole` is resolved from the user's `WorkspaceMembership`
for the active workspace, and `projectRoles` from their `ProjectMember` rows. The
two membership entities stay distinct; the principal is where they are combined
into one effective permission set for a request.

### With the module `PermissionHook`

The `permission.hooks` backend extension point
(`packages/modules-sdk/src/contracts.ts`) is where modules authorize actions, and
**this is the context that flows into it**. Today `PermissionHook.can(ctx, action,
subject)` receives the read-only `ProviderContext`. As authorization lands, the
host will supply the resolved `SessionPrincipal` (or derive `ProviderContext` from
it) so hooks decide against a real principal. Hooks remain composed with **AND**
(any `false` denies), so module authorization is additive and fail-closed: the
core grants a baseline via `hasPermission`, and modules can only further
restrict, never widen. This keeps the existing module-system invariant intact
while giving it a real authorization input.

### With the unified `WorkItem`

`WorkItem.assigneeId` is a `UserId`; "My Tasks" is the set of work items for
`principal.userId`. Mutations to work items are gated by `workitem:update` and, as
the next section describes, recorded in the audit trail so they can be reviewed and
(when reversible) undone.

---

## Deferred work

Explicitly **out of scope** for this phase and called out so no reader assumes
otherwise:

- **Real session / token issuance and any crypto** — password hashing, JWT
  signing/verification, cookie/session storage. The `SessionPrincipal` is
  constructed directly for now.
- **Live GitHub / GitLab / SSO integration** — authorization-code flows, token
  exchange, userinfo, JWKS. Provider records are stub metadata only.
- **SAML** — modeled (`IdentityProviderKind.Saml`) but not implemented.
- **Real session / token issuance** remains deferred even though users,
  identities, and memberships are now **persisted** in `@tundra/db` (the
  `users`, `external_identities`, and `workspace_memberships` tables) and the
  read-side `SessionPrincipal` is loaded from them in `db` mode via
  `loadSessionPrincipal`. What is still missing is authentication itself: the
  acting user comes from the dev `x-tundra-user-id` header, not a validated
  session (see [Dev session (current implementation)](#dev-session-current-implementation)).
  Provider records remain stub config (no table uses `identity_provider_kind`
  yet).
- **Rate limiting and security hardening** — lockouts, throttling, brute-force
  defenses, CSRF, etc. concentrate at the GraphQL boundary and are added when real
  auth lands (see [ADR-0006](../adr/ADR-0006-graphql-api-boundary.md)).

---

## Security baseline

- **No secrets in the repo.** Provider client ids/secrets, signing keys, and
  issuer credentials are supplied via environment variables validated by
  `@tundra/config`, following the repository `.env.example` convention. Only
  placeholders are committed.
- **Provider records hold no secrets** — only `displayName`, `issuer`, and
  `enabled`. Secrets live in env, keyed by the provider `id`.
- **Status gates access.** Only `Active` users authenticate; `Suspended` /
  `Deactivated` cannot obtain a usable principal.
- **Fail-closed authorization.** Permission checks default to deny, and module
  `PermissionHook`s compose with AND, so the absence of a grant is a denial.

---

## GitHub OAuth

Tundra supports "Continue with GitHub" as a first-class login option.
All GitHub OAuth credentials must come from environment variables — nothing
is hardcoded.

### Required environment variables

| Variable                | Description                                                             |
| ----------------------- | ----------------------------------------------------------------------- |
| `GITHUB_CLIENT_ID`      | GitHub OAuth App client ID                                              |
| `GITHUB_CLIENT_SECRET`  | GitHub OAuth App client secret (never exposed to frontend)              |
| `GITHUB_CALLBACK_URL`   | Callback URL registered in the GitHub OAuth App                         |
| `FRONTEND_URL`          | Frontend origin for post-login redirects (e.g. `http://localhost:5173`) |
| `VITE_GITHUB_CLIENT_ID` | Same as `GITHUB_CLIENT_ID` — controls button visibility in the web app  |

If all three backend credentials are absent (or empty), the feature degrades
safely: the API returns `503 provider_not_configured` from `/auth/github/start`,
and the frontend shows the "Continue with GitHub" button in a disabled state.

### Email/Password Auth

| Aspect         | Detail                                                         |
| -------------- | -------------------------------------------------------------- |
| Hash algorithm | scrypt (N=65536, r=8, p=1, keylen=64)                          |
| Salt           | 16 random bytes, stored as hex prefix of `credential_hash`     |
| Stored in      | `external_identities.credential_hash` (providerId=`email`)     |
| Comparison     | `timingSafeEqual` to prevent timing-based enumeration          |
| Endpoints      | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout` |

#### Session cookie

```
Name:     tundra.session
Value:    64-char hex raw token (32 random bytes)
Stored:   SHA-256 hash of the token in `sessions.token_hash`
Flags:    HttpOnly; SameSite=Lax; Secure (production only); Max-Age=7d; Path=/
```

### OAuth flow

```
Browser                     Tundra API              GitHub
  │                              │                      │
  │  GET /auth/github/start      │                      │
  │─────────────────────────────>│                      │
  │                              │ generate HMAC state  │
  │   302 → github.com/login/... │                      │
  │<─────────────────────────────│                      │
  │                              │                      │
  │  GET github.com/login/...    │                      │
  │─────────────────────────────────────────────────────>│
  │   302 → GITHUB_CALLBACK_URL?code=…&state=…          │
  │<─────────────────────────────────────────────────────│
  │                              │                      │
  │  GET /auth/github/callback   │                      │
  │─────────────────────────────>│                      │
  │                              │ validate state        │
  │                              │ exchange code → token │
  │                              │ fetch /user + /emails │
  │                              │ link or create user   │
  │   Set-Cookie: tundra.session │                      │
  │   302 → FRONTEND_URL/dashboard                      │
  │<─────────────────────────────│                      │
```

### State token security

States use HMAC-SHA256 signed by `GITHUB_CLIENT_SECRET`:

```
format:  ${nonce}.${unix_seconds}.${hmac_sha256(nonce + "." + ts, secret)}
ttl:     15 minutes
replay:  in-memory used-nonce Set (cleared after TTL); pruned on server restart
```

### Identity resolution

When a GitHub callback is received, the API resolves the Tundra user as follows:

1. **Existing GitHub identity** — `external_identities` row with `(providerId='github', subject=githubUserId)` found → open session for the linked user.
2. **Email match** — no existing GitHub identity but the **primary verified email** from GitHub's `/user/emails` endpoint matches a Tundra user's `primaryEmail` → link the GitHub identity to that user, then open a session.
   - Only the verified address from `/user/emails` is used. The unverified `email` field on the `/user` profile endpoint is **never** used for matching, to prevent account takeover via an unverified GitHub email.
   - If that Tundra user already has a _different_ GitHub account linked → return `identity_conflict`.
3. **New user** — no match → create a new Tundra user with the GitHub display name. Email is set only if GitHub returned a primary verified address (`emailVerified: true`); otherwise the account is created without a verified email (`emailVerified: false`).

### Error codes

| Code                        | When                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| `provider_not_configured`   | GitHub credentials not set in environment                        |
| `oauth_state_invalid`       | State missing, expired, tampered, or already used                |
| `oauth_exchange_failed`     | Code → token exchange with GitHub failed                         |
| `oauth_profile_unavailable` | GitHub `/user` endpoint returned an error                        |
| `email_conflict`            | (Reserved for future use)                                        |
| `identity_conflict`         | Email-matched user already has a different GitHub account linked |

All errors redirect to `FRONTEND_URL/login?error=<code>`.

### Security notes

- The raw GitHub access token is **never** stored.
- The raw session token is **never** stored (only its SHA-256 hash).
- `GITHUB_CLIENT_SECRET` is **never** exposed to the browser.
- Session cookies are `HttpOnly` and `SameSite=Lax`; `Secure` in production.
