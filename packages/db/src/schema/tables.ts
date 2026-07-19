/**
 * Starter Drizzle schema for the core tables.
 *
 * This is intentionally a SKELETON: enough core tables (workspaces, projects,
 * project_members, modules, work_items) to be real and typecheck, mapping to the
 * `@tundra/domain` shapes. It is NOT the full domain model — source-entity tables
 * (tasks, stories, sprints, …) and indexes/constraints are deferred.
 *
 * Migrations are generated from this schema; see `src/index.ts`.
 */

import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import {
	actionSourceEnum,
	projectRoleEnum,
	reversibilityEnum,
	userStatusEnum,
	workItemPriorityEnum,
	workItemSourceEnum,
	workItemStatusEnum,
	workspaceRoleEnum,
} from "./enums.js";

const timestamps = {
	createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
};

export const workspaces = pgTable("workspaces", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	ownerId: text("owner_id").notNull(),
	/** workspace-level module activation (array of ModuleId strings) */
	enabledModuleIds: jsonb("enabled_module_ids").$type<string[]>().notNull().default([]),
	...timestamps,
});

export const projects = pgTable("projects", {
	id: text("id").primaryKey(),
	workspaceId: text("workspace_id")
		.notNull()
		.references(() => workspaces.id),
	name: text("name").notNull(),
	key: text("key").notNull(),
	slug: text("slug").notNull(),
	description: text("description"),
	enabledModuleIds: jsonb("enabled_module_ids").$type<string[]>().notNull().default([]),
	archivedAt: timestamp("archived_at", { withTimezone: true, mode: "string" }),
	...timestamps,
});

export const projectMembers = pgTable(
	"project_members",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => projects.id),
		userId: text("user_id").notNull(),
		role: projectRoleEnum("role").notNull(),
		joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.projectId, table.userId] }),
	}),
);

export const modules = pgTable("modules", {
	id: text("id").primaryKey(),
	/** the full ModuleManifest, stored opaquely */
	manifest: jsonb("manifest").$type<Record<string, unknown>>().notNull(),
	enabled: boolean("enabled").notNull().default(true),
	...timestamps,
});

export const workItems = pgTable("work_items", {
	id: text("id").primaryKey(),
	projectId: text("project_id")
		.notNull()
		.references(() => projects.id),
	source: workItemSourceEnum("source").notNull(),
	/** back-reference to the originating entity ({ source, refId, moduleId? }) */
	sourceRef: jsonb("source_ref").$type<Record<string, unknown>>().notNull(),
	title: text("title").notNull(),
	status: workItemStatusEnum("status").notNull(),
	priority: workItemPriorityEnum("priority").notNull(),
	assigneeId: text("assignee_id"),
	dueDate: timestamp("due_date", { withTimezone: true, mode: "string" }),
	sprintId: text("sprint_id"),
	metadata: jsonb("metadata").$type<Record<string, unknown>>(),
	...timestamps,
});

// --- Identity & accounts ------------------------------------------------------

export const users = pgTable("users", {
	id: text("id").primaryKey(),
	primaryEmail: text("primary_email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	displayName: text("display_name").notNull(),
	status: userStatusEnum("status").notNull(),
	...timestamps,
});

export const externalIdentities = pgTable(
	"external_identities",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		/** matches an IdentityProvider.id, e.g. "email", "github", "oidc:acme" */
		providerId: text("provider_id").notNull(),
		/** provider-issued stable subject (OAuth/OIDC `sub`, or normalized email) */
		subject: text("subject").notNull(),
		email: text("email"),
		emailVerified: boolean("email_verified").notNull().default(false),
		linkedAt: timestamp("linked_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
		/**
		 * scrypt-derived password hash for the "email" provider only.
		 * Format: `${saltHex}:${hashHex}`. NULL for OAuth/OIDC identities.
		 */
		credentialHash: text("credential_hash"),
	},
	(table) => ({
		providerSubject: unique("external_identities_provider_subject_uniq").on(
			table.providerId,
			table.subject,
		),
	}),
);

export const workspaceMemberships = pgTable(
	"workspace_memberships",
	{
		id: text("id").primaryKey(),
		workspaceId: text("workspace_id")
			.notNull()
			.references(() => workspaces.id),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		role: workspaceRoleEnum("role").notNull(),
		joinedAt: timestamp("joined_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
	},
	(table) => ({
		workspaceUser: unique("workspace_memberships_workspace_user_uniq").on(
			table.workspaceId,
			table.userId,
		),
	}),
);

// --- Auth sessions ------------------------------------------------------------
//
// Sessions are server-side: the raw token lives only in the browser cookie; the
// DB stores its SHA-256 hash so a stolen DB row cannot be replayed directly.
// Invalidated sessions (logout) set `invalidatedAt`; expired sessions are
// identified by `expiresAt < now()`.

export const sessions = pgTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id),
		/** SHA-256 hex of the raw token stored in the browser cookie. */
		tokenHash: text("token_hash").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
			.notNull()
			.defaultNow(),
		expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
		/** Set on logout; NULL means the session is still active. */
		invalidatedAt: timestamp("invalidated_at", { withTimezone: true, mode: "string" }),
	},
	(table) => ({
		tokenHashUniq: unique("sessions_token_hash_uniq").on(table.tokenHash),
	}),
);

// --- Append-only audit log ----------------------------------------------------
//
// auditEvents is INSERT-ONLY: there is intentionally no `updatedAt` column and no
// repository ever updates or deletes a row. Undos are recorded as new
// compensating events (see reversalOfEventId), never as edits to the original.

export const auditEvents = pgTable(
	"audit_events",
	{
		id: text("id").primaryKey(),
		/** unset for system/automation actions with no human actor */
		actorUserId: text("actor_user_id"),
		source: actionSourceEnum("source").notNull(),
		/** scope: where the action happened */
		workspaceId: text("workspace_id"),
		projectId: text("project_id"),
		/** domain action name, e.g. "workitem.status_changed" */
		action: text("action").notNull(),
		/** kind of thing acted on, e.g. "WorkItem" */
		targetType: text("target_type").notNull(),
		targetId: text("target_id").notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "string" }).notNull(),
		before: jsonb("before").$type<Record<string, unknown>>(),
		after: jsonb("after").$type<Record<string, unknown>>(),
		/** minimal inverse payload needed to undo a reversible action */
		inverse: jsonb("inverse").$type<Record<string, unknown>>(),
		reversibility: reversibilityEnum("reversibility").notNull(),
		/** why an irreversible action cannot be undone (shown to the user) */
		irreversibleReason: text("irreversible_reason"),
		/** groups events that belong to one logical operation */
		correlationId: text("correlation_id"),
		/** set on a compensating event; points at the original it reverts */
		reversalOfEventId: text("reversal_of_event_id").references((): AnyPgColumn => auditEvents.id),
		createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
			.notNull()
			.defaultNow(),
	},
	(table) => ({
		targetIdx: index("audit_events_target_idx").on(table.targetType, table.targetId),
		reversalIdx: index("audit_events_reversal_of_idx").on(table.reversalOfEventId),
	}),
);

/**
 * Transactional outbox for the integration bus (Redpanda).
 *
 * Domain writes enqueue a row here in the same statement flow as the change;
 * the worker relays unpublished rows to Kafka topics and stamps
 * `published_at`. At-least-once: a relay crash between produce and stamp
 * re-sends the row, so consumers must be idempotent (keyed by `id`).
 */
export const integrationOutbox = pgTable(
	"integration_outbox",
	{
		id: text("id").primaryKey(),
		/** Destination topic, e.g. "tundra.events.workitem". */
		topic: text("topic").notNull(),
		/** Kafka message key (partitioning/compaction), e.g. the target id. */
		key: text("key"),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
			.notNull()
			.defaultNow(),
		/** Set when the relay confirmed the produce; null = pending. */
		publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }),
		/** Relay attempts so far (for backoff/diagnostics). */
		attempts: integer("attempts").notNull().default(0),
		lastError: text("last_error"),
	},
	(table) => ({
		pendingIdx: index("integration_outbox_pending_idx").on(table.publishedAt, table.createdAt),
	}),
);
