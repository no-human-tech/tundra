/**
 * @tundra/db — Drizzle schema, migrations, and typed data access.
 *
 * Depends only on `@tundra/domain` and `@tundra/config`. Maps persistence rows
 * to/from domain types. This package never connects at import time; use
 * `createDbClient(databaseUrl)` from app startup.
 *
 * Migrations are committed under `./drizzle` and generated from the schema with
 * the package scripts (which route drizzle-kit through a tsx loader — the bare
 * `drizzle-kit` binary cannot resolve the repo's ESM `.js` import specifiers):
 *
 *   corepack pnpm --filter @tundra/db run db:generate
 *   corepack pnpm --filter @tundra/db run db:migrate
 *
 * At runtime, apply them with `migrateToLatest(handle)` and seed a dev dataset
 * with `seedDev(handle)`.
 */

export * as schema from "./schema/index.js";

export { createDbClient } from "./client.js";
export type { DbClient, DbHandle } from "./client.js";

export { migrateToLatest } from "./migrate.js";
export { seedDev } from "./seed.js";

// Pure row ↔ domain mappers.
export {
	rowToProject,
	rowToWorkItem,
	workItemToInsert,
	rowToUser,
	rowToExternalIdentity,
	rowToWorkspaceMembership,
	rowToAuditEvent,
	auditEventToInsert,
} from "./mappers.js";

// Typed repository functions.
export {
	getUser,
	listProjects,
	getProject,
	getWorkItem,
	loadSessionPrincipal,
	selectMyTasksForUser,
	insertAuditEvent,
	getAuditHistory,
	isEventReverted,
	changeWorkItemStatus,
	revertAuditEvent,
	reconcileProviderWorkItems,
	createWorkItem,
	updateWorkItem,
	listWorkspaceMembers,
	changeWorkspaceMemberRole,
	hashPassword,
	verifyPassword,
	registerUser,
	loginUser,
	resolveSession,
	invalidateSession,
	loginWithGitHub,
	loginWithOidc,
	enqueueOutboxEvent,
	selectPendingOutbox,
	markOutboxPublished,
	markOutboxFailed,
} from "./repos.js";
export type {
	MyTasksRepoFilter,
	ChangeWorkItemStatusOk,
	CreateWorkItemInput,
	UpdateWorkItemInput,
	WorkspaceMemberRow,
	RegisterResult,
	LoginResult,
	LoginWithGitHubParams,
	LoginWithGitHubResult,
	IdpWorkspaceRole,
	LoginWithOidcParams,
	LoginWithOidcResult,
	OutboxMessage,
	OutboxRow,
} from "./repos.js";
