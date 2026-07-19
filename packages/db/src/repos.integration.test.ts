/**
 * Integration tests for the repository layer against a REAL Postgres.
 *
 * Guarded: they connect to `TEST_DATABASE_URL ?? DATABASE_URL` and self-skip
 * (via `describe.skipIf`) when neither is set, so the default `pnpm test` run is
 * unaffected. They are EXCLUDED from the default vitest config and run only via
 * `pnpm --filter @tundra/db test:integration`.
 *
 * The suite migrates + seeds a fresh schema once, then exercises My Tasks
 * aggregation, the reversible status-change PoC, revert authorization (own vs
 * admin vs forbidden), the already-reverted guard, and the append-only invariant.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";

import {
	ActionSource,
	Reversibility,
	RevertDenyReason,
	WorkItemPriority,
	WorkItemSource,
	WorkItemStatus,
} from "@tundra/domain";
import type { AuditEventId, SessionPrincipal, UserId, WorkItemId } from "@tundra/domain";

import { createDbClient } from "./client.js";
import type { DbHandle } from "./client.js";
import { migrateToLatest } from "./migrate.js";
import { seedDev } from "./seed.js";
import {
	changeWorkItemStatus,
	enqueueOutboxEvent,
	getAuditHistory,
	insertAuditEvent,
	isEventReverted,
	loadSessionPrincipal,
	loginWithGitHub,
	loginWithOidc,
	markOutboxFailed,
	markOutboxPublished,
	registerUser,
	revertAuditEvent,
	selectMyTasksForUser,
	selectPendingOutbox,
} from "./repos.js";
import { auditEvents, workItems, workspaceMemberships, workspaces } from "./schema/tables.js";

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("repositories (integration)", () => {
	let handle: DbHandle;

	beforeAll(async () => {
		handle = createDbClient(databaseUrl as string);
		await migrateToLatest(handle);
		// Start from a clean slate, then seed the demo dataset.
		await handle.db.execute(
			sql`TRUNCATE TABLE
        audit_events,
        integration_outbox,
        sessions,
        external_identities,
        workspace_memberships,
        project_members,
        work_items,
        modules,
        projects,
        users,
        workspaces
        RESTART IDENTITY CASCADE`,
		);
		await seedDev(handle);
	});

	afterAll(async () => {
		if (handle) {
			await handle.close();
		}
	});

	it("seedDev is idempotent (a second run is a no-op)", async () => {
		await seedDev(handle);
		const rows = await handle.db.select({ id: workItems.id }).from(workItems);
		// The seed inserts 9 work items; a second seedDev must not duplicate them.
		expect(rows.length).toBe(9);
	});

	it("selectMyTasksForUser aggregates a mixed-source set for Ada (incl. story_checklist + extension)", async () => {
		const items = await selectMyTasksForUser(handle.db, "user-ada");
		const sources = new Set(items.map((i) => i.source));

		// Mixed sources, including the two specifically required.
		expect(sources.has(WorkItemSource.StoryChecklist)).toBe(true);
		expect(sources.has(WorkItemSource.Extension)).toBe(true);
		expect(sources.size).toBeGreaterThanOrEqual(3);

		// Default excludes Done/Cancelled: the seeded done task must not appear.
		expect(items.some((i) => i.id === ("wi-task-done" as WorkItemId))).toBe(false);
		expect(items.every((i) => i.assigneeId === ("user-ada" as UserId))).toBe(true);
	});

	it("loadSessionPrincipal resolves Ada as workspace admin with audit:revert:any", async () => {
		const principal = await loadSessionPrincipal(handle.db, "user-ada");
		expect(principal).not.toBeNull();
		expect(principal?.source).toBe(ActionSource.User);
		expect(principal?.workspaceRole).toBe("admin");
		expect(principal?.permissions).toContain("audit:revert:any");
		expect(principal?.projectRoles?.["proj-core"]).toBe("owner");
	});

	it("changeWorkItemStatus updates the item and appends a reversible audit event", async () => {
		const principal = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;

		// Use a dedicated item so other tests stay isolated.
		await handle.db.insert(workItems).values({
			id: "wi-status-1",
			projectId: "proj-core",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-status-1" },
			title: "Status change PoC item",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Medium,
			assigneeId: "user-ada",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		const result = await changeWorkItemStatus(handle.db, {
			workItemId: "wi-status-1",
			status: WorkItemStatus.InProgress,
			principal,
		});
		expect("error" in result).toBe(false);
		if ("error" in result) return;

		expect(result.workItem.status).toBe(WorkItemStatus.InProgress);
		expect(result.event.action).toBe("workitem.status_changed");
		expect(result.event.reversibility).toBe(Reversibility.Reversible);
		expect(result.event.before).toEqual({ status: WorkItemStatus.Todo });
		expect(result.event.after).toEqual({ status: WorkItemStatus.InProgress });
		expect(result.event.inverse).toEqual({ status: WorkItemStatus.Todo });

		const history = await getAuditHistory(handle.db, "WorkItem", "wi-status-1");
		expect(history.length).toBe(1);
		expect(history[0]?.id).toBe(result.event.id);
	});

	it("changeWorkItemStatus returns not_found for a missing work item", async () => {
		const principal = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;
		const result = await changeWorkItemStatus(handle.db, {
			workItemId: "does-not-exist",
			status: WorkItemStatus.Done,
			principal,
		});
		expect(result).toEqual({ error: "not_found" });
	});

	it("revertAuditEvent: the actor may revert their own action; the original row is untouched", async () => {
		const ada = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;

		await handle.db.insert(workItems).values({
			id: "wi-revert-own",
			projectId: "proj-core",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-revert-own" },
			title: "Revert own item",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			assigneeId: "user-ada",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		const changed = await changeWorkItemStatus(handle.db, {
			workItemId: "wi-revert-own",
			status: WorkItemStatus.Done,
			principal: ada,
		});
		if ("error" in changed) throw new Error("setup failed");
		const originalId = changed.event.id;

		// Snapshot the original audit row before the revert.
		const beforeRows = await handle.db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.id, originalId));
		const beforeRow = beforeRows[0];

		const decision = await revertAuditEvent(handle.db, {
			eventId: originalId,
			principal: ada,
		});
		expect(decision.allowed).toBe(true);
		if (!decision.allowed) return;
		expect(decision.event).toBeDefined();
		expect(decision.event?.reversalOfEventId).toBe(originalId);

		// The work item status is restored to the inverse (Todo).
		const itemRows = await handle.db
			.select()
			.from(workItems)
			.where(eq(workItems.id, "wi-revert-own"));
		expect(itemRows[0]?.status).toBe(WorkItemStatus.Todo);

		// Append-only invariant: the ORIGINAL event row is byte-for-byte unchanged.
		const afterRows = await handle.db
			.select()
			.from(auditEvents)
			.where(eq(auditEvents.id, originalId));
		expect(afterRows[0]).toEqual(beforeRow);

		// A compensating event now exists; isEventReverted reflects it.
		expect(await isEventReverted(handle.db, originalId)).toBe(true);
		const history = await getAuditHistory(handle.db, "WorkItem", "wi-revert-own");
		expect(history.some((e) => e.reversalOfEventId === originalId)).toBe(true);
	});

	it("revertAuditEvent: re-reverting an already-reverted event is rejected", async () => {
		const ada = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;

		await handle.db.insert(workItems).values({
			id: "wi-revert-twice",
			projectId: "proj-core",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-revert-twice" },
			title: "Revert twice item",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			assigneeId: "user-ada",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		const changed = await changeWorkItemStatus(handle.db, {
			workItemId: "wi-revert-twice",
			status: WorkItemStatus.Done,
			principal: ada,
		});
		if ("error" in changed) throw new Error("setup failed");

		const first = await revertAuditEvent(handle.db, { eventId: changed.event.id, principal: ada });
		expect(first.allowed).toBe(true);

		const second = await revertAuditEvent(handle.db, { eventId: changed.event.id, principal: ada });
		expect(second.allowed).toBe(false);
		if (second.allowed) return;
		expect(second.reason).toBe(RevertDenyReason.AlreadyReverted);
	});

	it("revertAuditEvent: an admin may revert another user's action", async () => {
		const ada = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;
		const bob = (await loadSessionPrincipal(handle.db, "user-bob")) as SessionPrincipal;

		await handle.db.insert(workItems).values({
			id: "wi-revert-admin",
			projectId: "proj-ops",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-revert-admin" },
			title: "Admin reverts member action",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			assigneeId: "user-bob",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		// Bob (member) makes the change.
		const changed = await changeWorkItemStatus(handle.db, {
			workItemId: "wi-revert-admin",
			status: WorkItemStatus.InProgress,
			principal: bob,
		});
		if ("error" in changed) throw new Error("setup failed");

		// Ada (admin) reverts Bob's action — allowed via audit:revert:any.
		const decision = await revertAuditEvent(handle.db, {
			eventId: changed.event.id,
			principal: ada,
		});
		expect(decision.allowed).toBe(true);
	});

	it("revertAuditEvent: a member may NOT revert another user's action", async () => {
		const ada = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;
		const bob = (await loadSessionPrincipal(handle.db, "user-bob")) as SessionPrincipal;

		await handle.db.insert(workItems).values({
			id: "wi-revert-forbidden",
			projectId: "proj-core",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "task-revert-forbidden" },
			title: "Member cannot revert admin action",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Low,
			assigneeId: "user-ada",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});

		// Ada (admin) makes the change.
		const changed = await changeWorkItemStatus(handle.db, {
			workItemId: "wi-revert-forbidden",
			status: WorkItemStatus.Done,
			principal: ada,
		});
		if ("error" in changed) throw new Error("setup failed");

		// Bob (member) tries to revert Ada's action — denied.
		const decision = await revertAuditEvent(handle.db, {
			eventId: changed.event.id,
			principal: bob,
		});
		expect(decision.allowed).toBe(false);
		if (decision.allowed) return;
		expect(decision.reason).toBe(RevertDenyReason.NotAuthorized);
	});

	it("revertAuditEvent: a missing event id is reported as not_found", async () => {
		const ada = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;
		const decision = await revertAuditEvent(handle.db, {
			eventId: "evt_missing" as AuditEventId,
			principal: ada,
		});
		expect(decision.allowed).toBe(false);
		if (decision.allowed) return;
		expect(decision.reason).toBe(RevertDenyReason.NotFound);
	});

	it("insertAuditEvent + getAuditHistory return events chronologically", async () => {
		const base = Date.now();
		const mk = (n: number) => ({
			id: `evt_hist_${n}` as AuditEventId,
			source: ActionSource.System,
			action: "test.event",
			targetType: "HistFixture",
			targetId: "hist-1",
			occurredAt: new Date(base + n * 1000).toISOString(),
			reversibility: Reversibility.Irreversible,
			irreversibleReason: "fixture",
			createdAt: new Date(base + n * 1000).toISOString(),
			updatedAt: new Date(base + n * 1000).toISOString(),
		});

		// Insert out of order; history must come back oldest-first.
		await insertAuditEvent(handle.db, mk(3));
		await insertAuditEvent(handle.db, mk(1));
		await insertAuditEvent(handle.db, mk(2));

		const history = await getAuditHistory(handle.db, "HistFixture", "hist-1");
		expect(history.map((e) => e.id)).toEqual(["evt_hist_1", "evt_hist_2", "evt_hist_3"]);
	});

	// --- loginWithGitHub integration tests ---

	it("loginWithGitHub: existing GitHub identity opens a session without email-match", async () => {
		// First login creates the identity.
		const first = await loginWithGitHub(handle.db, {
			githubUserId: "gh-itest-1",
			githubLogin: "itest1",
			githubName: "ITest One",
			verifiedEmail: null,
			workspaceId: "ws-tundra",
		});
		expect("error" in first).toBe(false);
		if ("error" in first) return;

		// Second login with same GitHub user id must return the SAME userId.
		const second = await loginWithGitHub(handle.db, {
			githubUserId: "gh-itest-1",
			githubLogin: "itest1",
			githubName: "ITest One",
			verifiedEmail: null,
			workspaceId: "ws-tundra",
		});
		expect("error" in second).toBe(false);
		if ("error" in second) return;
		expect(second.userId).toBe(first.userId);
		expect(second.linked).toBe(false);
	});

	it("loginWithGitHub: verifiedEmail links to an existing user by primaryEmail", async () => {
		// Register a Tundra user with email.
		const regResult = await registerUser(handle.db, {
			email: "linkme@example.com",
			password: "password123",
			displayName: "Link Me",
			workspaceId: "ws-tundra",
		});
		expect("error" in regResult).toBe(false);
		if ("error" in regResult) return;
		const existingUserId = regResult.userId;

		// GitHub login with the same verified email must link to that user.
		const ghResult = await loginWithGitHub(handle.db, {
			githubUserId: "gh-itest-2",
			githubLogin: "linkme_gh",
			githubName: "Link Me GH",
			verifiedEmail: "linkme@example.com",
			workspaceId: "ws-tundra",
		});
		expect("error" in ghResult).toBe(false);
		if ("error" in ghResult) return;
		expect(ghResult.userId).toBe(existingUserId);
		expect(ghResult.linked).toBe(true);
	});

	it("loginWithGitHub: null verifiedEmail does NOT link to an existing user by profile email", async () => {
		// Register a Tundra user with email.
		const regResult = await registerUser(handle.db, {
			email: "nolinkme@example.com",
			password: "password123",
			displayName: "No Link Me",
			workspaceId: "ws-tundra",
		});
		expect("error" in regResult).toBe(false);
		if ("error" in regResult) return;
		const existingUserId = regResult.userId;

		// GitHub login with verifiedEmail=null must create a NEW user, not link.
		const ghResult = await loginWithGitHub(handle.db, {
			githubUserId: "gh-itest-3",
			githubLogin: "nolinkme_gh",
			githubName: "No Link Me GH",
			verifiedEmail: null, // no verified email — must NOT match by profile email
			workspaceId: "ws-tundra",
		});
		expect("error" in ghResult).toBe(false);
		if ("error" in ghResult) return;
		// A new user must have been created, not the existing one.
		expect(ghResult.userId).not.toBe(existingUserId);
		expect(ghResult.linked).toBe(true); // linked=true means a new identity was created
	});

	it("loginWithGitHub: identity_conflict when user already has a different GitHub account", async () => {
		// Register a user.
		const regResult = await registerUser(handle.db, {
			email: "conflictme@example.com",
			password: "password123",
			displayName: "Conflict Me",
			workspaceId: "ws-tundra",
		});
		expect("error" in regResult).toBe(false);
		if ("error" in regResult) return;

		// Link a GitHub identity to this user.
		const firstLink = await loginWithGitHub(handle.db, {
			githubUserId: "gh-itest-conflict-1",
			githubLogin: "conflict1",
			githubName: "Conflict 1",
			verifiedEmail: "conflictme@example.com",
			workspaceId: "ws-tundra",
		});
		expect("error" in firstLink).toBe(false);

		// A different GitHub account tries to link via same email — must be rejected.
		const conflict = await loginWithGitHub(handle.db, {
			githubUserId: "gh-itest-conflict-2",
			githubLogin: "conflict2",
			githubName: "Conflict 2",
			verifiedEmail: "conflictme@example.com",
			workspaceId: "ws-tundra",
		});
		expect("error" in conflict).toBe(true);
		if (!("error" in conflict)) return;
		expect(conflict.error).toBe("identity_conflict");
	});

	// --- loginWithOidc -----------------------------------------------------------

	it("loginWithOidc provisions a new user with the IdP-asserted role", async () => {
		const result = await loginWithOidc(handle.db, {
			providerId: "oidc:keycloak",
			subject: "kc-itest-new",
			verifiedEmail: "oidc-new@example.com",
			name: "Oidc New",
			workspaceRole: "admin",
			workspaceId: "ws-tundra",
		});
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.linked).toBe(true);

		const memberships = await handle.db
			.select()
			.from(workspaceMemberships)
			.where(eq(workspaceMemberships.userId, result.userId));
		expect(memberships[0]?.role).toBe("admin");

		// Second login: same user, no new identity, role re-synced downward
		// (allowed — Ada also holds admin, so this is not the last admin).
		const again = await loginWithOidc(handle.db, {
			providerId: "oidc:keycloak",
			subject: "kc-itest-new",
			verifiedEmail: "oidc-new@example.com",
			name: "Oidc New",
			workspaceRole: "member",
			workspaceId: "ws-tundra",
		});
		expect("error" in again).toBe(false);
		if ("error" in again) return;
		expect(again.userId).toBe(result.userId);
		expect(again.linked).toBe(false);

		const resynced = await handle.db
			.select()
			.from(workspaceMemberships)
			.where(eq(workspaceMemberships.userId, result.userId));
		expect(resynced[0]?.role).toBe("member");
	});

	it("loginWithOidc links to an existing user by verified email", async () => {
		const reg = await registerUser(handle.db, {
			email: "oidc-linkme@example.com",
			password: "password123",
			displayName: "Oidc Link Me",
			workspaceId: "ws-tundra",
		});
		expect("error" in reg).toBe(false);
		if ("error" in reg) return;

		const result = await loginWithOidc(handle.db, {
			providerId: "oidc:keycloak",
			subject: "kc-itest-link",
			verifiedEmail: "oidc-linkme@example.com",
			name: "Oidc Link",
			workspaceRole: "member",
			workspaceId: "ws-tundra",
		});
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.userId).toBe(reg.userId);
		expect(result.linked).toBe(true);

		// The same email with a DIFFERENT subject at the same provider conflicts.
		const conflict = await loginWithOidc(handle.db, {
			providerId: "oidc:keycloak",
			subject: "kc-itest-link-other",
			verifiedEmail: "oidc-linkme@example.com",
			name: "Oidc Other",
			workspaceRole: "member",
			workspaceId: "ws-tundra",
		});
		expect("error" in conflict).toBe(true);
	});

	it("loginWithOidc never demotes the last admin of a role", async () => {
		// A dedicated workspace with exactly one admin.
		await handle.db.insert(workspaces).values({
			id: "ws-oidc-lastadmin",
			name: "OIDC Last Admin",
			slug: "oidc-lastadmin",
			ownerId: "user-ada",
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		const admin = await loginWithOidc(handle.db, {
			providerId: "oidc:keycloak",
			subject: "kc-itest-lastadmin",
			verifiedEmail: "oidc-lastadmin@example.com",
			name: "Last Admin",
			workspaceRole: "admin",
			workspaceId: "ws-oidc-lastadmin",
		});
		expect("error" in admin).toBe(false);
		if ("error" in admin) return;

		// The IdP now says "member", but the demotion would leave no admin — skip.
		const demoted = await loginWithOidc(handle.db, {
			providerId: "oidc:keycloak",
			subject: "kc-itest-lastadmin",
			verifiedEmail: "oidc-lastadmin@example.com",
			name: "Last Admin",
			workspaceRole: "member",
			workspaceId: "ws-oidc-lastadmin",
		});
		expect("error" in demoted).toBe(false);

		const rows = await handle.db
			.select()
			.from(workspaceMemberships)
			.where(eq(workspaceMemberships.userId, admin.userId));
		const membership = rows.find((r) => r.workspaceId === "ws-oidc-lastadmin");
		expect(membership?.role).toBe("admin");
	});

	// --- Integration outbox --------------------------------------------------------

	it("outbox: enqueue, select pending, publish, and failure bookkeeping", async () => {
		const id1 = await enqueueOutboxEvent(handle.db, {
			topic: "tundra.events.test",
			key: "k1",
			payload: { n: 1 },
		});
		const id2 = await enqueueOutboxEvent(handle.db, {
			topic: "tundra.events.test",
			payload: { n: 2 },
		});

		const pending = await selectPendingOutbox(handle.db, 1000);
		const mine = pending.filter((r) => r.id === id1 || r.id === id2);
		expect(mine.map((r) => r.id)).toEqual([id1, id2]); // oldest first
		expect(mine[0]?.key).toBe("k1");
		expect(mine[1]?.key).toBeNull();

		await markOutboxFailed(handle.db, id1, "broker unreachable");
		const afterFail = await selectPendingOutbox(handle.db, 1000);
		const failed = afterFail.find((r) => r.id === id1);
		expect(failed?.attempts).toBe(1); // still pending, attempt recorded

		await markOutboxPublished(handle.db, [id1, id2]);
		const afterPublish = await selectPendingOutbox(handle.db, 1000);
		expect(afterPublish.some((r) => r.id === id1 || r.id === id2)).toBe(false);
	});

	it("insertAuditEvent enqueues an outbox row on the workitem topic", async () => {
		const principal = (await loadSessionPrincipal(handle.db, "user-ada")) as SessionPrincipal;
		await handle.db.insert(workItems).values({
			id: "wi-outbox-1",
			projectId: "proj-core",
			source: WorkItemSource.Task,
			sourceRef: { source: WorkItemSource.Task, refId: "wi-outbox-1" },
			title: "Outbox probe",
			status: WorkItemStatus.Todo,
			priority: WorkItemPriority.Medium,
			assigneeId: "user-ada",
		});

		const result = await changeWorkItemStatus(handle.db, {
			workItemId: "wi-outbox-1",
			status: WorkItemStatus.InProgress,
			principal,
		});
		expect("error" in result).toBe(false);

		const pending = await selectPendingOutbox(handle.db, 1000);
		const row = pending.find(
			(r) => r.topic === "tundra.events.workitem" && r.key === "wi-outbox-1",
		);
		expect(row).toBeDefined();
		expect(row?.payload["kind"]).toBe("audit-event");
	});
});
