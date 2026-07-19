/**
 * CI-GATED INVARIANT: WorkItem aggregation correctness (My Tasks).
 *
 * Tundra's defining product rule (CLAUDE.md "Main principles"): "My Tasks"
 * aggregates assigned work from ALL sources — tasks, user-story checklist items,
 * subtasks, bugs, reviews, docs follow-ups, automation, and extension-generated
 * actions — into a single unified view over the `WorkItem` read model. This file
 * is one of the two non-negotiable, CI-gated invariant suites; it must always
 * pass. A failure here means "My Tasks" has silently become task-only, started
 * leaking another user's work, or lost a source — all real product regressions.
 *
 * Unlike the co-located domain unit tests (which build WorkItems inline), this
 * suite exercises the SHARED fixtures (`sampleWorkItems`, covering all eight
 * sources) against the real `selectMyTasks`, proving the fixtures and the
 * aggregation agree. Source coverage is checked exhaustively by iterating
 * `Object.values(WorkItemSource)`.
 *
 * Companion invariant: `packages/domain/src/navigation-invariant.test.ts`.
 */

import { describe, expect, it } from "vitest";

import { WorkItemSource, WorkItemStatus, selectMyTasks } from "@tundra/domain";

import { ADA, BOB, sampleProjects, sampleWorkItems } from "./index.js";

describe("INVARIANT: WorkItem aggregation correctness (My Tasks)", () => {
	it("fixtures cover ALL eight WorkItemSource values (exhaustive source coverage)", () => {
		const present = new Set(sampleWorkItems.map((wi) => wi.source));
		const allSources = Object.values(WorkItemSource);

		// 8 declared sources, every one represented in the fixtures.
		expect(allSources.length).toBe(8);
		for (const source of allSources) {
			expect(present.has(source), `fixtures are missing WorkItemSource.${source}`).toBe(true);
		}
	});

	it("selectMyTasks returns only the requested assignee's items", () => {
		const adaItems = selectMyTasks(sampleWorkItems, { assigneeId: ADA });
		expect(adaItems.length).toBeGreaterThan(0);
		for (const item of adaItems) {
			expect(item.assigneeId).toBe(ADA);
		}

		// BOB's set must be disjoint from ADA's and contain none of ADA's ids.
		const bobItems = selectMyTasks(sampleWorkItems, {
			assigneeId: BOB,
			includeStatuses: undefined,
		});
		for (const item of bobItems) {
			expect(item.assigneeId).toBe(BOB);
		}
		const adaIds = new Set(adaItems.map((i) => i.id));
		for (const item of bobItems) {
			expect(adaIds.has(item.id)).toBe(false);
		}
	});

	it("excludes Done and Cancelled by default", () => {
		const result = selectMyTasks(sampleWorkItems, { assigneeId: ADA });
		for (const item of result) {
			expect(item.status).not.toBe(WorkItemStatus.Done);
			expect(item.status).not.toBe(WorkItemStatus.Cancelled);
		}
	});

	it("returns a set spanning MULTIPLE sources (My Tasks is unified, not task-only)", () => {
		const result = selectMyTasks(sampleWorkItems, { assigneeId: ADA });
		const sources = new Set(result.map((i) => i.source));

		// The whole point of the unified model: more than one source kind, and not
		// exclusively WorkItemSource.Task.
		expect(sources.size).toBeGreaterThan(1);
		expect([...sources].some((s) => s !== WorkItemSource.Task)).toBe(true);
	});

	it("every returned item carries a sourceRef whose source matches item.source", () => {
		const result = selectMyTasks(sampleWorkItems, { assigneeId: ADA });
		expect(result.length).toBeGreaterThan(0);
		for (const item of result) {
			expect(item.sourceRef, `${item.id} has no sourceRef`).toBeDefined();
			expect(item.sourceRef.source, `${item.id} sourceRef.source mismatch`).toBe(item.source);
		}
	});

	it("the `sources` filter narrows to exactly the requested source kinds", () => {
		const wanted = [WorkItemSource.Bug, WorkItemSource.Review];
		const result = selectMyTasks(sampleWorkItems, { assigneeId: ADA, sources: wanted });

		expect(result.length).toBeGreaterThan(0);
		for (const item of result) {
			expect(wanted).toContain(item.source);
		}
		// No item of an unrequested source slips through.
		expect(
			result.every((i) => i.source === WorkItemSource.Bug || i.source === WorkItemSource.Review),
		).toBe(true);
	});

	it("the `projectId` filter narrows to a single project", () => {
		const coreId = sampleProjects[0]!.id;
		const webId = sampleProjects[1]!.id;

		const coreItems = selectMyTasks(sampleWorkItems, { assigneeId: ADA, projectId: coreId });
		expect(coreItems.length).toBeGreaterThan(0);
		for (const item of coreItems) {
			expect(item.projectId).toBe(coreId);
		}

		// A different project yields a different (disjoint) slice.
		const webItems = selectMyTasks(sampleWorkItems, { assigneeId: ADA, projectId: webId });
		for (const item of webItems) {
			expect(item.projectId).toBe(webId);
		}
		const coreIds = new Set(coreItems.map((i) => i.id));
		for (const item of webItems) {
			expect(coreIds.has(item.id)).toBe(false);
		}
	});

	it("includeStatuses overrides the default active-only behaviour", () => {
		// Default excludes Done; an explicit includeStatuses of [Done] surfaces it.
		const defaultResult = selectMyTasks(sampleWorkItems, { assigneeId: ADA });
		expect(defaultResult.some((i) => i.status === WorkItemStatus.Done)).toBe(false);

		const doneOnly = selectMyTasks(sampleWorkItems, {
			assigneeId: ADA,
			includeStatuses: [WorkItemStatus.Done],
		});
		expect(doneOnly.length).toBeGreaterThan(0);
		for (const item of doneOnly) {
			expect(item.status).toBe(WorkItemStatus.Done);
		}
	});
});
