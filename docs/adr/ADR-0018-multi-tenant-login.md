# ADR-0018: Multi-tenant login via tenant subdomains and Keycloak Organizations

- **Status:** Accepted
- **Date:** 2026-07-19

## Context

Tundra is moving to a new primary domain, `tundra.team`, with two product
requirements: **multi-tenant login** — the organization a user belongs to
determines the context they see after login ("logowanie multi tenant — w
zależności od organizacji pojawia się odpowiedni kontekst") — and
**self-service organization creation from the landing page**.

The product owner has decided the following points, which this ADR designs
around (an earlier draft recommended path-based tenancy and DB-only
membership; that recommendation is superseded):

1. **Tenants are recognized by unique subdomains** — `<org>.tundra.team`
   (e.g. `no-human.tundra.team`), on the wildcard-cert + subdomain-ingress
   approach. During tenant setup the user picks a free subdomain, with an
   availability check and a reserved-name list.
2. **Identity management uses Keycloak Organizations** (first-class in the
   existing Keycloak 26.6 at `id.no-human.tech`). For the `no-human`
   organization, authorization goes through GitHub OAuth as that org's IdP.
3. **The API is called locally (same-origin)**: the SPA uses a relative
   `/graphql` on each tenant subdomain; api+web are served on every
   subdomain. The absolute baked `VITE_API_URL` goes away in production.
4. **OIDC uses a central callback on the apex**
   (`tundra.team/auth/oidc/callback`) with a secure session handoff to the
   tenant subdomain.
5. **Instance operators can suspend organizations**: an instance operator
   must be able to block/suspend an organization (for example when its
   name/subdomain violates the law). The suspension/reinstate machinery is
   engine-level.
6. **Tenant subdomains skip the landing page**: "Wejście z subdomeny (np.
   no-human.tundra.team) powinno kierować od razu do autoryzacji z
   pominięciem landing page" — an unauthenticated visit to a tenant
   subdomain redirects immediately to authorization; the landing page lives
   only on the apex.
7. **All language versions**: "Ważne — nanieś zmiany we wszystkich wersjach
   językowych." Every user-facing string this design introduces ships in all
   nine locales (en, pl, es, de, fr, it, zh, ko, ja); see the locale-coverage
   requirement under Sequencing.

The codebase is single-tenant in practice but not in schema:

- `packages/db/src/schema/tables.ts` already models `workspaces` (unique
  `slug`, `ownerId`, `enabledModuleIds`), `workspaceMemberships` (unique
  `(workspaceId, userId)` with a workspace role), `projects.workspaceId`,
  `projectMembers`, and workspace-scoped `auditEvents`. Users, external
  identities, and sessions are correctly global (one human, many tenants).
- The runtime collapses this to one tenant: `loadSessionPrincipal`
  (`packages/db/src/repos.ts`) loads **the first** membership (`limit(1)`)
  and **all** project roles regardless of workspace; every login flow in
  `apps/api/src/data-source/db.ts` attaches new users to a hardcoded
  `DEFAULT_WORKSPACE_ID = "ws-tundra"`; `listProjects` returns every project
  in the database.
- Auth (ADR-0008/0010/0012): local email/password and direct GitHub OAuth for
  self-hosted installs; central OIDC (realm `no-human`, client `tundra`,
  Authorization Code + PKCE) for production. Sessions are DB-backed
  `tundra.session` cookies — `SameSite=Lax`, `HttpOnly`, **host-only** (no
  `Domain` attribute; see `buildSessionCookie` in `apps/api/src/index.ts`).
  The OIDC transaction cookie (`tundra.oidc`) is likewise host-only; OAuth
  state single-use is enforced by a Redis-backed nonce store (`SET NX PX`)
  shared by all api replicas.
- The SPA bakes `VITE_API_URL` at image build time (ADR-0016). It is
  consumed in exactly three places: `apps/web/src/api/client.ts` (GraphQL
  endpoint), `apps/web/src/api/auth.ts` and
  `apps/web/src/pages/LoginPage.tsx` (both strip the trailing `/graphql` to
  derive the `/auth/*` base).
- **Keycloak does not allow wildcards in the redirect-URI host**, so
  `https://*.tundra.team/auth/oidc/callback` cannot be registered.
- Known RBAC gaps from the audit remain preconditions, not parallel work:
  `changeWorkspaceMemberRole` has no admin check, work-item mutations skip
  `workitem:write`, `createProject` is a client-side mock, `isSuperAdmin` is
  never granted, and there is no member-management UI.
- Infra: one k8s deployment (2 stateless api replicas), one Postgres (CNPG),
  Traefik ingress. The DNS zone `tundra.team` already carries a wildcard
  `* CNAME tundra.team.` record; a wildcard certificate `*.tundra.team` is
  issued by the existing `letsencrypt-ovh-dns01` ClusterIssuer (DNS-01);
  Traefik matches tenant hosts with `HostRegexp`.

## Decision

### 1. Tenant unit: the existing workspace **is** the organization

Unchanged from the earlier draft. No new `organizations` table: `workspaces`
already has the unique slug, owner, role-bearing memberships, project
containment, and audit scoping a tenant needs. In user-facing copy the tenant
is an **organization** (PL: _organizacja_); in code and schema it remains
`workspace`. The workspace `slug` becomes load-bearing: it is the subdomain
label **and** the Keycloak Organization alias (Decision 5).

### 2. Tenant recognition: one subdomain per organization, api+web served on every subdomain

    tundra.team                    → apex: landing page, org signup, auth hub, org picker/router
    <org>.tundra.team              → tenant: SPA + API, org-scoped context
    <org>.tundra.team/projects/:id → project-scoped navigation (ADR-0004), unchanged shape

- **Routing.** Traefik serves the apex with ``Host(`tundra.team`)`` and all
  tenants with ``HostRegexp(`^[a-z0-9-]+\.tundra\.team$`)``, both backed by
  the same web and api Services and terminated by the wildcard
  `*.tundra.team` certificate (`letsencrypt-ovh-dns01`). The existing
  `* CNAME tundra.team.` record means **no DNS work per tenant** — a new org
  is reachable the moment the app knows its slug.
- **Same-origin per tenant.** The api is exposed on every subdomain under
  `/graphql` and `/auth/*`, next to the SPA. Each tenant origin is therefore
  self-contained and the `SameSite=Lax`, host-only session cookie works
  unmodified — logging into `acme.tundra.team` sets a cookie valid only
  there. We deliberately do **not** set `Domain=.tundra.team`: a per-host
  cookie means one tenant's session token is never even transmitted to
  another tenant's origin, and cross-org SSO comes from Keycloak instead
  (Decision 4).
- **SPA change: relative API URL (decided).** Production images are built
  with `VITE_API_URL=/graphql`; the absolute baked API URL is removed from
  the production build pipeline. All three consumption sites keep working
  without logic changes: `client.ts` fetches the value as-is (relative URLs
  resolve against the current origin), and `auth.ts` / `LoginPage.tsx` strip
  `/graphql` leaving `""`, so `${apiBase}/auth/github/start` becomes the
  relative `/auth/github/start`. The hardcoded
  `http://localhost:4000/graphql` fallbacks stay for host-run dev only (web
  `:5173`, api `:4000`, CORS as today). In production, `CORS_ORIGIN` shrinks
  to the apex origin — tenant traffic is same-origin and needs no CORS.
- **Tenant hosts never serve the landing page (decided).** The landing page,
  signup, and org picker exist only on the apex. An **unauthenticated**
  document request on `<org>.tundra.team` is answered with an immediate
  redirect into authorization (flow in Decision 3) — the requested deep link
  is preserved and restored after login. A subdomain that maps to no active
  workspace renders a neutral "organization unavailable" page.
- **Tenant resolution is Host-based but never authority-granting.** The API's
  context factory extracts the subdomain label from the `Host` header
  (validated against `^[a-z0-9-]{3,40}$`), resolves it to a workspace by
  slug, and builds the principal with `loadSessionPrincipal(userId,
workspaceId)` — memberships in the DB decide access. To anonymous traffic,
  a nonexistent, suspended, or non-member org all look identical (the
  neutral unavailable page — no tenant enumeration); an **authenticated**
  non-member instead sees an explicit access-denied page (Decision 7). The
  apex host resolves to **no** tenant context and serves only
  landing/signup/auth/picker concerns.
- Global vs project navigation stay separate (CLAUDE.md): the org context is
  carried by the origin itself; the org switcher lives in global navigation
  and is a cross-origin link to the sibling subdomain; project-scoped top
  navigation is untouched.

### 3. Keycloak redirect URIs: central apex callback with a single-use handoff code (decided)

Keycloak forbids wildcard redirect-URI hosts. The alternative — per-tenant
redirect-URI registration via the Admin API at org creation — is rejected:
it requires `manage-clients` on the shared realm (a service account that can
rewrite _every_ product's client — far more privilege than organization CRUD
needs); the redirect-URI list becomes an unbounded, concurrently-mutated
array on one client (read-modify-write races between simultaneous org
creations); and a Keycloak Admin API outage at org-creation time would leave
a tenant whose logins can never complete, a failure no retry queue can hide
from a user mid-login.

**Decision: central apex callback.** The `tundra` client keeps exactly two
static redirect URIs (`https://tundra.team/auth/oidc/callback` plus the dev
URL), and the whole OIDC transaction is confined to the apex host:

    1. Unauthenticated GET https://acme.tundra.team/projects/x
       → 302 https://tundra.team/auth/oidc/start?returnTo=acme&path=/projects/x
         IMMEDIATELY — no landing page on tenant hosts.
         returnTo = tenant slug, validated against existing active workspaces;
         path = local-path-only deep link, validated against ^/[^/]
    2. Apex sets the host-only tundra.oidc txn cookie (unchanged HMAC design;
       the txn now also carries {targetSlug, path})
       → 302 Keycloak authorization endpoint WITH THE ORG HINT:
         scope "openid profile email organization:acme"
         (Keycloak Organizations org-scoped login), so Keycloak applies the
         org's linked IdP — for no-human, users land straight on GitHub
         OAuth with no intermediate IdP chooser. kc_idp_hint is the fallback
         when an org has exactly one linked IdP and the org-scope routing is
         not in effect.
    3. Keycloak → https://tundra.team/auth/oidc/callback
       (txn cookie present — same host as /start; state/nonce/PKCE verified
        exactly as today, replay-blocked by the Redis nonce store)
    4. Apex resolves the user (loginWithOidc), issues the apex DB session,
       mints a HANDOFF CODE
       → 302 https://acme.tundra.team/auth/session/claim?code=…
    5. Tenant host consumes the code atomically, verifies its bindings,
       issues a FRESH DB-backed session (new token, new sessions row) whose
       host-only tundra.session cookie is scoped to acme.tundra.team, and
       finishes with a 302 to the preserved deep link (path from the code's
       payload, default /dashboard).

**Handoff mechanism, concretely.** The building blocks are the two stores
that already exist — the DB-backed session store and the Redis nonce store:

- The code is 256 bits from a CSPRNG, sent only inside the 302 `Location`.
  Redis stores it under `tundra:handoff:<sha256(code)>` (hash at rest, like
  session tokens in the DB) with a **60-second TTL** and the value
  `{ userId, targetSlug, path, uaHash }`, where `path` is the validated deep
  link and `uaHash` is the SHA-256 of the initiating request's `User-Agent`.
- `/auth/session/claim` on the tenant host consumes the key with an atomic
  `GETDEL` (single-use across all replicas — the same guarantee the nonce
  store gives OAuth state), then verifies **both bindings**: the `Host`
  subdomain label must equal `targetSlug`, and the claiming request's
  `User-Agent` hash must equal `uaHash`. Any mismatch, replay, or expiry
  discards the claim and restarts the login (step 1) — never a partial
  session.
- On success the tenant host creates a **new** session row via the existing
  session store and sets the regular cookie. The code never carries or
  reveals a session token; it is an opaque server-side reference, and the
  apex session token never leaves the apex origin. Per-host session rows
  keep tenant-local logout exact.
- The UA binding is a hurdle, not a boundary (UAs are spoofable); the real
  protections are the 60 s TTL, single-use atomicity, subdomain binding,
  hashed storage, and HTTPS-only transport.

This preserves every replica-safety property of ADR-0012 (signed txn cookie,
Redis single-use) because start and callback share one host, adds one
redirect, and keeps the Keycloak client configuration static forever. The
`returnTo` slug allowlist (must match an existing, **active** workspace —
suspended orgs refuse handoff, Decision 5) prevents open redirects; the slug
binding prevents a code minted for one tenant from being claimed on another.

**Authenticated non-members.** Membership is deliberately NOT checked before
the handoff: the flow completes, the session is claimed, and the SPA on the
subdomain renders an explicit **access-denied page** ("you don't have access
to this organization", with links to the user's own organizations and the
apex picker). No silent redirect to the user's own org — the user asked for
this org and gets an honest answer. The API backs this by returning the
authenticated viewer with no tenant context for that host; every
workspace-scoped field stays unauthorized.

- **Logout.** `POST /auth/logout` on a tenant host invalidates that DB
  session and clears the host cookie (tenant-local logout). "Log out
  everywhere" invalidates all of the user's DB sessions and then chains to
  the apex `GET /auth/oidc/logout`, whose RP-initiated end-session redirect
  uses the single static `post_logout_redirect_uri` `https://tundra.team/`.
- **Multi-org users.** One Keycloak SSO session serves all tenants: entering
  a second org repeats steps 1–5, but step 2's authorization request is
  satisfied silently by the IdP session — no re-authentication. The apex also
  issues its own (apex-host) session cookie after callback so the **org
  picker** on `tundra.team` can list the user's memberships and mint handoff
  codes; `users.lastWorkspaceId` preselects the default. A user who ends up
  with zero memberships (e.g. removed from their last org) is pointed at the
  org-creation flow (Decision 5) or at support — **there is no general login
  or self-registration for unaffiliated users on the apex** (decided).

### 4. Keycloak topology: one realm, one client, **Keycloak Organizations** for tenant identity

- The realm stays `no-human`, the login client stays `tundra`. Each Tundra
  organization is mirrored as a **Keycloak Organization** whose **alias
  equals the workspace slug** (same charset and reserved-name rules, so one
  validation covers subdomain, DB, and Keycloak).
- **Organization domain field (optional).** Keycloak Organizations carry a
  domain field used for domain-based login routing. The OSS engine does not
  require an organization to own or verify a domain; where an org has one it
  populates this field. Whether domain ownership is mandated when an
  organization is created is a commercial-edition policy, out of scope here.
- **Realm self-registration stays disabled.** Members enter through their
  tenant subdomain, and organizations are provisioned through the API
  (Decision 5).
- **Per-org IdPs.** Keycloak Organizations lets each org link its own
  identity providers. For the `no-human` organization, the existing GitHub
  broker is linked as the org's IdP, so its members authenticate via GitHub
  OAuth. Other orgs start with realm-default authentication and can get
  their own IdP linked later (the enterprise-SSO path) without any Tundra
  code change.
- **Token claims → membership sync.** The `tundra` client requests the
  `organization` scope; tokens then carry an `organization` claim listing
  the user's org aliases. On every login the callback syncs this claim into
  `workspaceMemberships` (add missing memberships as `member`; never touch
  `owner`; never demote the last admin — the ADR-0012 guards). Tundra's DB
  remains the authority for **roles** and for self-hosted installs (which
  have no Keycloak and manage memberships purely in the DB); Keycloak
  Organizations is the authority for **who may authenticate into which org**
  in the SaaS deployment.
- **Instance operator.** The former global `admin` claim mapping (ADR-0012)
  is rescoped: it grants `isSuperAdmin` (instance operator) instead of a
  workspace role. Per-org `owner/admin/member` are managed in Tundra's
  member-management UI (and, additively, by the org-claim sync above).
- **Service account.** A dedicated confidential client
  (`tundra-provisioner`, client-credentials grant) performs organization
  CRUD via the Admin API. Its realm-management permissions are scoped to
  organization management (fine-grained admin permissions) — explicitly
  **not** `manage-clients`. Its credentials live in Vault and reach the api
  pods through the cluster's existing secret-sync mechanism; they are never
  in the repo or image.

### 5. Organization provisioning: two-system provisioning with DB-first outbox semantics

Creating an organization is a two-system operation: a DB-first transaction
reserves the slug (unique index) and writes the owner membership and a
provisioning outbox row; the worker idempotently creates the matching
Keycloak Organization (alias = slug) and activates the workspace; a
reconciliation job repairs partial failures. The sequence reuses the existing
transactional outbox (`integrationOutbox`) and worker:

    1. SLUG VALIDATION. The requested slug matches [a-z0-9-]{3,40}, is not in
       the reserved list (www, api, id, admin, login, auth, docs, status,
       mail, apex, …), has no workspaces.slug row, and no Keycloak org with
       that alias — one validation covers subdomain, DB, and Keycloak.
    2. MUTATION TRANSACTION: INSERT workspace (status = 'provisioning') +
       owner membership + audit event `workspace.created` + outbox row
       `workspace.provision`. The DB unique index on slug is the global
       reservation lock — two concurrent claims of a slug cannot both commit.
    3. WORKER (idempotent, so at-least-once outbox delivery is safe): create
       the Keycloak Organization (alias = slug) and enroll the owner.
    4. ACTIVATION. Worker stamps the workspace 'active'. The owner's first
       real login flows the normal tenant path (Decision 3); the OIDC
       callback links the Keycloak subject to the Tundra user through the
       existing verified-email linking path (ADR-0008/0012), creating the
       externalIdentities row.

The self-service SaaS onboarding funnel that drives this API — founder
identity/email-domain verification, anti-abuse controls, and the signup
wizard UI — is part of the commercial Tundra Pro edition and is specified
privately, not here. Self-hosted installs create organizations directly
through this API (see the deployment guide's `org:create`).

The subdomain router serves only active workspaces; a provisioning org shows
a "being prepared" page for the seconds (or, during a Keycloak outage,
minutes) it takes. Failure semantics fall out of the ordering: a Keycloak
failure only delays activation (retry with backoff; permanent failure marks
the workspace `failed` and surfaces a retry — the DB row keeps the slug
reserved either way, so no squatter can race in). The inverse drift (Keycloak
org exists, DB row lost) cannot occur in this ordering, but a periodic
**reconciliation job** compares org aliases to workspace rows in both
directions and alerts on mismatch, as a backstop for manual admin-console
edits.

Rules retained from the earlier draft: creator becomes owner
(`workspaces.ownerId` + `owner` membership — mirroring
creator-becomes-project-admin); org creation never grants instance rights;
uniform "organization unavailable" for unknown subdomains.

**Suspension, reinstatement, and purge (instance-operator machinery).**

- `workspaces.status` gains a `suspended` value
  (`provisioning | active | suspended | failed`), set and cleared by
  `isSuperAdmin`-only mutations `suspendOrganization(id, reason)` /
  `reinstateOrganization(id)`, each writing an audit event
  (`workspace.suspended` / `workspace.reinstated`; suspension is reversible
  in the ADR-0009 sense).
- A suspended org's subdomain serves the same neutral **"organization
  unavailable"** page as a nonexistent one (no public distinction), logins
  and handoff codes targeting it are rejected (`returnTo` validation in
  Decision 3 requires `active`), existing sessions lose tenant context on
  the next request (the context factory checks status when resolving the
  Host), and background processing for the workspace is paused. Suspension
  blocks access, it deletes nothing, and reinstatement restores the tenant
  unchanged. After a retention window an instance operator may **purge** the
  workspace: a separate, explicitly irreversible, audit-logged operation
  (`workspace.purged`, `irreversibleReason` set per ADR-0009) that also
  removes the Keycloak Organization and releases the slug.

### 6. Data isolation: single database, shared schema, `workspaceId` scoping (unchanged)

Unchanged from the earlier draft. Schema-per-tenant remains rejected at this
scale. The work is closing the scoping gaps at the repository layer: every
read/write filters by the principal's `workspaceId` (`listProjects` is the
loudest leak); `loadSessionPrincipal(db, userId, workspaceId)` replaces the
`limit(1)` pick and restricts project roles to the active workspace;
`work_items` gains a denormalized, backfilled `workspaceId` (cheap scoping
now, Postgres RLS-ready later); outbox payload envelopes gain `workspaceId`;
indexes on the used columns. The subdomain model strengthens this: the
tenant is fixed per origin, so the SPA cannot even accidentally mix tenants
in one browsing context.

### 7. Post-login context: what the SPA loads

    unauthenticated on tenant host → immediate redirect to apex auth
                                     (no landing page; deep link preserved)
    login (apex OIDC → handoff)    → tundra.session cookie on <org>.tundra.team
                                     → 302 to the preserved deep link
    SPA boot on the tenant host    → viewer { user, workspace { id slug name },
                                     workspaceRole, memberships { … } }
      member     → org-scoped app; memberships drive the org switcher
      non-member → access-denied page (links to own orgs + apex picker)
    apex, authenticated, no ?returnTo:
      0 orgs → /welcome/new-org      1 org → 302 to its subdomain
      n orgs → org picker (lastWorkspaceId preselected)

The tenant is implied by the origin, so the SPA needs no route prefix and no
per-request tenant header — the `Host` header carries it. Self-hosted
single-org installs behave exactly as today (their one host resolves to
their one workspace; apex behaviors are SaaS-profile configuration).

### 8. Migration of the current single-tenant deployment

- The existing `ws-tundra` workspace becomes the `no-human` organization: a
  migration sets `workspaces.slug = 'no-human'` (id unchanged), and the
  provisioning path runs once against Keycloak to create the matching
  Organization, link the existing GitHub broker as its IdP, and enroll
  current members.
- **The apex stops serving the app.** `tundra.team` becomes landing page +
  org signup + auth hub + org picker/router. During a transition window the
  apex 301-redirects old deep links (`tundra.team/projects/…` →
  `no-human.tundra.team/projects/…`) — safe because there is exactly one
  tenant today. Existing sessions are host-bound to the apex and simply
  require one re-login through the new flow.
- Existing Keycloak `tundra/admin` group members are re-mapped per the
  instance-operator decision (see open questions).

### 9. Sequencing — PR-sized, RBAC enforcement first

1. **Enforce existing RBAC** (precondition): admin check on
   `changeWorkspaceMemberRole`, `workitem:write` on all work-item mutations,
   workspace filter on `listProjects`. No schema change.
2. **Instance operator**: `isSuperAdmin` from the rescoped IdP claim +
   first-user bootstrap for self-hosted installs.
3. **Host-based tenancy plumbing**: `VITE_API_URL=/graphql` build arg (dev
   fallbacks kept), Host-header tenant resolution in the context factory,
   `loadSessionPrincipal(userId, workspaceId)`, `viewer.memberships`,
   removal of `DEFAULT_WORKSPACE_ID`; migrations for
   `work_items.workspaceId`, `users.lastWorkspaceId`, `workspaces.status`.
   Infra: apex + `HostRegexp` IngressRoutes on the wildcard cert.
4. **Apex auth hub**: OIDC start/callback confined to the apex,
   `returnTo`/`path` validation, immediate unauthenticated redirect from
   tenant hosts (no landing page), org-scoped authorization requests
   (`organization:<alias>` / `kc_idp_hint`), `/auth/session/claim` handoff
   endpoint (Redis single-use, slug + UA binding, deep-link restore), apex
   session + org picker, logout chaining, membership sync from the org
   claim.
5. **Provisioning + member management**: `createOrganization` (DB-first +
   outbox job + idempotent Admin-API org creation + owner enrollment +
   activation), slug validation + reserved-name list, member management
   (role changes, membership removal with the ADR-0012 guards, Keycloak
   propagation), `suspendOrganization` / `reinstateOrganization`
   (instance-operator only, status checks in the context factory and
   handoff) + purge job, `tundra-provisioner` service account via Vault,
   reconciliation job; real `createProject` mutation replacing the client
   mock.
6. **Web**: tenant-host-aware boot, org switcher, zero-org onboarding,
   access-denied and "organization unavailable" pages, member-management UI.
7. **Migration**: `ws-tundra` → `no-human` slug, one-shot Keycloak org
   provisioning + GitHub IdP link, apex redirect window.
8. **Deferred** (separate ADRs when needed): Postgres RLS, per-org
   enterprise IdPs beyond `no-human`. Customer-owned custom domains are
   **off the roadmap** (decided) — not deferred, removed.

**Locale coverage is part of each step's definition of done — not a
follow-up.** Every user-facing string introduced by steps 4–6 — the
tenant-subdomain auth screens, the access-denied page for non-members, the
"organization unavailable" page, and the org switcher, zero-org onboarding,
and member-management UI — ships in **all nine locales**
(en, pl, es, de, fr, it, zh, ko, ja) via the existing i18n catalog
(`apps/web/src/i18n/locales/*.json`), whose key parity the `i18n:check`
gate (`apps/web/scripts/check-locales.mjs`) enforces against `en.json`.

## Consequences

- A new organization is live with zero DNS/cert/Keycloak-client work: the
  wildcard CNAME and certificate already cover it, and the static two-entry
  redirect-URI list never changes. Tenant provisioning touches only the DB
  and one idempotent Organizations API call.
- Session tokens are host-scoped: a tenant's cookie is never even
  transmitted to another tenant's origin, giving browser-enforced session
  isolation on top of DB-side membership checks. The cost is one extra
  redirect pair per first-visit-per-org — invisible in practice because
  Keycloak's SSO session answers silently.
- The api and web must be reachable on every tenant host; the SPA's API
  endpoint becomes origin-relative and `CORS_ORIGIN` shrinks to the apex.
  Host-run dev (`:5173` → `:4000`) keeps the absolute-URL + CORS path.
- Org creation is no longer a single-system write. The DB-first + outbox
  design makes Keycloak unavailability degrade to "organization being
  prepared" instead of an error page, at the price of an asynchronous
  activation step and a reconciliation job to own.
- The shared Keycloak gains per-tenant state (Organizations) managed by an
  application service account — a standing operational contract with the
  platform team: the alias namespace equals the Tundra slug namespace, and
  admin-console edits to organizations can now drift from Tundra's DB
  (mitigated, not eliminated, by reconciliation).
- Instance operators can suspend a tenant (access blocked, data retained,
  reversible). This makes the long-missing `isSuperAdmin` grant a hard
  dependency, not a nice-to-have.
- Tenant hosts have no anonymous surface at all — every unauthenticated
  document request bounces to the apex auth hub. Anything meant to be
  public (status pages, marketing) must live on the apex by construction.
- Ruling out customer-owned custom domains keeps the platform permanently on
  one wildcard certificate and one DNS record, and lets the handoff claim
  endpoint and Host parsing hard-require the `.tundra.team` suffix — a
  smaller, simpler trust boundary.
- With no general registration and no unaffiliated login, the apex exposes
  only the auth hop and the org picker — a deliberately small anonymous
  attack surface.
- Rescoping the IdP `admin` claim changes behavior for current
  Keycloak-group admins (instance operators instead of workspace admins);
  per-org roles move into Tundra's UI. Must be communicated before rollout.
- Self-hosted installs keep working with no Keycloak: membership stays
  DB-authoritative; apex behaviors, handoff, and Organizations sync are
  SaaS-profile configuration.

## Resolved questions

The product owner resolved the design-level open questions on 2026-07-19;
the decisions are folded into the sections above:

1. **Keycloak Organizations domain field** → optional in the OSS engine; an
   organization is not required to own or verify a domain. Any policy that
   mandates domain ownership when an organization is created is a
   commercial-edition concern (Decision 4).
2. **Unaffiliated users on the apex** → **blocked**; no general
   self-registration or login. Entry points are tenant-subdomain login and
   organization provisioning through the API (Decision 5); the owner's
   Keycloak/Tundra identity is created by the provisioning worker and linked
   at first OIDC login.
3. **Custom domains** → **off the roadmap**; question closed
   (simplifications noted in Consequences).

## Remaining open items (operational, non-blocking for acceptance)

1. **Provisioner permissions** (platform team): the exact fine-grained
   admin-permission set for `tundra-provisioner` (organization + user CRUD,
   not `manage-clients`) and the Vault path / secret-sync mechanism.
2. **Org-claim role semantics**: may the `organization` claim ever _remove_
   memberships (offboarding via Keycloak), or is removal Tundra-UI-only?
   Until decided, the sync is add-only.
3. **Existing `tundra/admin` group members**: instance operators, owners of
   the migrated `no-human` org, or both? Default at migration: both, unless
   overridden.
4. **Apex redirect window**: how long `tundra.team/*` deep-link redirects to
   `no-human.tundra.team` stay in place (proposed: 90 days).
