/**
 * Idempotent development seed.
 *
 * `seedDev` is a no-op when the demo workspace (`ws-tundra`) already exists, so
 * it is safe to run repeatedly. It populates a small but representative dataset:
 * one workspace, two users (an Admin and a Member) with email identities and
 * workspace memberships, three projects, the Helpdesk module, and a set of
 * WorkItems that covers ALL eight `WorkItemSource` values — most assigned to Ada
 * so "My Tasks" shows a mixed-source set (including story_checklist and
 * extension) across statuses and priorities.
 *
 * This is the I/O layer: generating timestamps with `Date` and using stable
 * literal ids is allowed here (unlike the pure domain).
 */

import { eq } from "drizzle-orm";

import {
	ProjectRole,
	WorkItemPriority,
	WorkItemSource,
	WorkItemStatus,
	WorkspaceRole,
	UserStatus,
} from "@tundra/domain";

import type { DbHandle } from "./client.js";
import { hashPassword } from "./repos.js";
import {
	externalIdentities,
	modules,
	projectMembers,
	projects,
	users,
	workItems,
	workspaceMemberships,
	workspaces,
} from "./schema/tables.js";

const WORKSPACE_ID = "ws-tundra";

/**
 * Seed the development dataset. Idempotent: returns immediately if `ws-tundra`
 * already exists.
 *
 * @param handle An open database handle from `createDbClient`.
 */
export async function seedDev(handle: DbHandle): Promise<void> {
	const db = handle.db;

	const existing = await db
		.select({ id: workspaces.id })
		.from(workspaces)
		.where(eq(workspaces.id, WORKSPACE_ID))
		.limit(1);
	if (existing.length > 0) {
		return;
	}

	const now = new Date().toISOString();

	// --- Workspace --------------------------------------------------------------
	await db.insert(workspaces).values({
		id: WORKSPACE_ID,
		name: "Tundra",
		slug: "tundra",
		ownerId: "user-ada",
		enabledModuleIds: ["mod-helpdesk"],
		createdAt: now,
		updatedAt: now,
	});

	// --- Users ------------------------------------------------------------------
	await db.insert(users).values([
		{
			id: "user-ada",
			primaryEmail: "ada@example.com",
			emailVerified: true,
			displayName: "Ada Lovelace",
			status: UserStatus.Active,
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "user-bob",
			primaryEmail: "bob@example.com",
			emailVerified: true,
			displayName: "Bob Martin",
			status: UserStatus.Active,
			createdAt: now,
			updatedAt: now,
		},
	]);

	// --- External identities (email provider) -----------------------------------
	// Dev passwords: ada@example.com → "password-ada", bob@example.com → "password-bob"
	// These are hashed with scrypt so real auth (login) works against the seed data.
	const [adaHash, bobHash] = await Promise.all([
		hashPassword("password-ada"),
		hashPassword("password-bob"),
	]);

	await db.insert(externalIdentities).values([
		{
			id: "ext-ada-email",
			userId: "user-ada",
			providerId: "email",
			subject: "ada@example.com",
			email: "ada@example.com",
			emailVerified: true,
			linkedAt: now,
			credentialHash: adaHash,
		},
		{
			id: "ext-bob-email",
			userId: "user-bob",
			providerId: "email",
			subject: "bob@example.com",
			email: "bob@example.com",
			emailVerified: true,
			linkedAt: now,
			credentialHash: bobHash,
		},
	]);

	// --- Workspace memberships --------------------------------------------------
	await db.insert(workspaceMemberships).values([
		{
			id: "wsm-ada",
			workspaceId: WORKSPACE_ID,
			userId: "user-ada",
			role: WorkspaceRole.Admin,
			joinedAt: now,
		},
		{
			id: "wsm-bob",
			workspaceId: WORKSPACE_ID,
			userId: "user-bob",
			role: WorkspaceRole.Member,
			joinedAt: now,
		},
	]);

	// --- Projects ---------------------------------------------------------------
	await db.insert(projects).values([
		{
			id: "proj-core",
			workspaceId: WORKSPACE_ID,
			name: "Tundra Core",
			key: "TUN",
			slug: "tundra-core",
			description: "Aurora Platform — the Tundra core product.",
			enabledModuleIds: ["mod-helpdesk"],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "proj-web",
			workspaceId: WORKSPACE_ID,
			name: "Web",
			key: "WEB",
			slug: "web",
			description: "Frontend application.",
			enabledModuleIds: [],
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "proj-ops",
			workspaceId: WORKSPACE_ID,
			name: "Ops",
			key: "OPS",
			slug: "ops",
			description: "Infrastructure and operations.",
			enabledModuleIds: ["mod-helpdesk"],
			createdAt: now,
			updatedAt: now,
		},
	]);

	// --- Project memberships ----------------------------------------------------
	await db.insert(projectMembers).values([
		{ projectId: "proj-core", userId: "user-ada", role: ProjectRole.Owner, joinedAt: now },
		{ projectId: "proj-core", userId: "user-bob", role: ProjectRole.Member, joinedAt: now },
		{ projectId: "proj-web", userId: "user-ada", role: ProjectRole.Admin, joinedAt: now },
		{ projectId: "proj-ops", userId: "user-bob", role: ProjectRole.Member, joinedAt: now },
	]);

	// --- Helpdesk module --------------------------------------------------------
	await db.insert(modules).values({
		id: "mod-helpdesk",
		manifest: {
			id: "mod-helpdesk",
			name: "Helpdesk",
			version: "1.0.0",
			description: "Customer support tickets surfaced as WorkItems.",
			author: "Tundra",
			contributes: [],
			permissions: ["workitem:write"],
			providesWorkItemSources: [WorkItemSource.Extension],
		},
		enabled: true,
		createdAt: now,
		updatedAt: now,
	});

	// --- WorkItems: one per source, most assigned to Ada ------------------------
	// Covers all eight WorkItemSource values across statuses and priorities.
	await db.insert(workItems).values([
		{
			id: "wi-task-1",
			projectId: "proj-core",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-1" },
			title: "Design the unified WorkItem read model",
			status: WorkItemStatus.InProgress,
			priority: WorkItemPriority.High,
			assigneeId: "user-ada",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "wi-story-1",
			projectId: "proj-core",
			source: WorkItemSource.StoryChecklist,
			sourceRef: { source: WorkItemSource.StoryChecklist, refId: "checklist-1" },
			title: "Acceptance: My Tasks aggregates all sources",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Medium,
			assigneeId: "user-ada",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "wi-subtask-1",
			projectId: "proj-core",
			source: WorkItemSource.Subtask,
			sourceRef: { source: WorkItemSource.Subtask, refId: "task-2" },
			title: "Write row↔domain mappers",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Medium,
			assigneeId: "user-ada",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "wi-bug-1",
			projectId: "proj-web",
			source: WorkItemSource.Bug,
			sourceRef: { source: WorkItemSource.Bug, refId: "bug-1" },
			title: "Nav blends global and project scope on resize",
			status: WorkItemStatus.Blocked,
			priority: WorkItemPriority.Urgent,
			assigneeId: "user-ada",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "wi-review-1",
			projectId: "proj-core",
			source: WorkItemSource.Review,
			sourceRef: { source: WorkItemSource.Review, refId: "pr-42" },
			title: "Review: persistence slice PR",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.High,
			assigneeId: "user-ada",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "wi-docs-1",
			projectId: "proj-core",
			source: WorkItemSource.Docs,
			sourceRef: { source: WorkItemSource.Docs, refId: "doc-1" },
			title: "Docs follow-up: document the seed dataset",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			assigneeId: "user-ada",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "wi-automation-1",
			projectId: "proj-ops",
			source: WorkItemSource.Automation,
			sourceRef: { source: WorkItemSource.Automation, refId: "auto-1" },
			title: "Automation: nightly backup verification failed",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.High,
			assigneeId: "user-bob",
			createdAt: now,
			updatedAt: now,
		},
		{
			id: "wi-extension-1",
			projectId: "proj-core",
			source: WorkItemSource.Extension,
			sourceRef: {
				source: WorkItemSource.Extension,
				refId: "ticket-1001",
				moduleId: "mod-helpdesk",
			},
			title: "Helpdesk: customer cannot reset password",
			status: WorkItemStatus.InProgress,
			priority: WorkItemPriority.Urgent,
			assigneeId: "user-ada",
			metadata: { ticketId: "1001", channel: "email" },
			createdAt: now,
			updatedAt: now,
		},
		// A done item (assigned to Ada) so My Tasks default-excludes it.
		{
			id: "wi-task-done",
			projectId: "proj-core",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-done" },
			title: "Scaffold the @tundra/db package",
			status: WorkItemStatus.Done,
			priority: WorkItemPriority.Medium,
			assigneeId: "user-ada",
			createdAt: now,
			updatedAt: now,
		},
	]);
}
