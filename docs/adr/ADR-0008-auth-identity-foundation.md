# ADR-0008: Authentication & identity foundation

- **Status:** Accepted
- **Date:** 2026-06-28

## Context

The domain already references `UserId` everywhere — `Workspace.ownerId`,
`ProjectMember.userId`, `WorkItem.assigneeId`, `TimeEntry.userId` — but there was
no `User` entity, no model of the identities that authenticate a user, no
workspace-level membership to complement the project-scoped `ProjectMember`, and no
authorization context for the API to reason about. Tundra must support several auth
sources (email; OAuth/OIDC for GitHub and GitLab; workspace/enterprise SSO; SAML
later) without coupling the core to any one of them, and the `permission.hooks`
extension point (ADR-0005) needs a real principal to authorize against. We want the
authorization contract to be stable and testable _before_ any real session,
token, or identity-provider integration exists, so the rest of the system can be
built against it. This is design plus pure domain helpers only — no crypto, no live
providers.

## Decision

Add the identity foundation to `@tundra/domain` as pure types and pure functions.
Introduce `User` (`Entity<UserId>` with `primaryEmail`, `emailVerified`,
`displayName`, `UserStatus`), `ExternalIdentity`
(`Entity<ExternalIdentityId>` linking a user to a provider via `providerId` +
`subject`), and `IdentityProvider` as host config keyed by a **stable string id**
(`"email"`, `"github"`, `"gitlab"`, `"oidc:<slug>"`) with `IdentityProviderKind`
(`email | oauth | oidc | saml`). Enforce two linking invariants with pure helpers:
`(providerId, subject)` maps to at most one user, and emails are normalized — via
`normalizeEmail`, `identityKey(providerId, subject)`, and
`findIdentityConflict(existing, candidate)`. Add the workspace role scope
(`WorkspaceRole` = `owner | admin | member | guest` and
`WorkspaceMembership` as the counterpart to `ProjectMember`), model permissions as
plain strings (`type Permission = string`) resolved by the pure
`permissionsForWorkspaceRole` / `permissionsForProjectRole`, and define the API
authorization context `SessionPrincipal` (carrying `userId?`, `source: ActionSource`,
`workspaceId?`, `workspaceRole?`, `projectRoles?`, the effective `permissions`, and
`isSuperAdmin?`) with `hasPermission` and `isWorkspaceAdmin`. The `SessionPrincipal`
flows into the module `PermissionHook` (composed with AND, fail-closed). **OIDC is
the first-class SSO path; SAML is modeled but documented as planned, not
implemented.** Provider records are stub metadata only; secrets come from env via
`@tundra/config` (the `.env.example` convention), never the repo. Real session/token
issuance, crypto, live GitHub/GitLab/SSO integration, SAML, and persistence are
explicitly deferred.

## Consequences

- The whole stack now has one stable authorization contract (`SessionPrincipal`,
  `hasPermission`, `isWorkspaceAdmin`) to build against before any real auth exists,
  so the API boundary and the `PermissionHook` seam can be wired without rework.
- Workspace and project authority stay **separate but composable**:
  `WorkspaceMembership` and `ProjectMember` are distinct entities, combined into one
  effective permission set on the principal — mirroring the global/project
  separation invariant.
- Account linking is deterministic: `(providerId, subject)` resolves to a single
  user and emails are normalized, so "sign in with X" cannot silently fork an
  account. The rules live in pure helpers and are unit-testable at the lowest layer.
- Permissions as strings + pure role resolvers let modules introduce their own
  capabilities via the manifest without a core change, and keep role-to-permission
  mapping in exactly one place.
- Reserving `IdentityProviderKind.Saml` keeps the model forward-compatible at the
  cost of an enum value with no implementation yet; this is the intended trade.
- Deferring crypto, live providers, and persistence keeps this change small and
  reviewable, but means the foundation is not yet usable for real sign-in — that is
  a deliberate, separate step.
