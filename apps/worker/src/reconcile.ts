/**
 * WorkItem provider reconciliation (minimal).
 *
 * The worker's eventual job is to pull WorkItems from each registered provider
 * (bugs, reviews, docs follow-ups, extensions) and materialize them into the
 * unified WorkItem read model idempotently. This file ships the smallest honest
 * version of that: given a set of providers for a project, collect their items
 * and hand them to `@tundra/db`'s `reconcileProviderWorkItems`, which upserts by
 * id (no duplicates on re-run).
 *
 * DEFERRED (intentionally not built here):
 *  - A real provider REGISTRY wired to `@tundra/modules-sdk` WorkItemProvider
 *    contributions; this takes providers as a plain argument instead.
 *  - SCHEDULING / triggering (cron, on-demand, change events).
 *  - RETRIES / backoff / dead-lettering (BullMQ supports these; not configured).
 *  - SOFT-DELETE of items a provider no longer returns (current upsert is
 *    insert-or-update only).
 */

import { reconcileProviderWorkItems } from "@tundra/db";
import type { DbHandle } from "@tundra/db";
import type { WorkItem } from "@tundra/domain";

/**
 * A minimal provider seam: anything that can yield the current WorkItems for a
 * project. The real registry (deferred) will adapt module WorkItemProvider
 * contributions to this shape.
 */
export interface WorkItemProviderLike {
	/** Stable provider id, for logging/diagnostics. */
	id: string;
	/** Return the provider's current WorkItems for the given project. */
	fetch(projectId: string): Promise<WorkItem[]>;
}

/** Outcome of a reconciliation pass for one project. */
export interface ReconcileResult {
	projectId: string;
	providerCount: number;
	fetched: number;
	upserted: number;
}

/**
 * Pure provider-collection step: fetch every provider's WorkItems for a project
 * and concatenate them, preserving provider order. Split out from the db wrapper
 * so it is unit-testable with NO database (see `reconcile.test.ts`).
 *
 * @param projectId The project to fetch items for.
 * @param providers The providers to pull from.
 */
export async function collectProviderItems(
	projectId: string,
	providers: readonly WorkItemProviderLike[],
): Promise<WorkItem[]> {
	const collected: WorkItem[] = [];
	for (const provider of providers) {
		const items = await provider.fetch(projectId);
		collected.push(...items);
	}
	return collected;
}

/**
 * Pull WorkItems from each provider for a project and upsert them idempotently.
 *
 * @param handle Open db handle (supplied by worker startup, never at import).
 * @param projectId The project whose provider items are being reconciled.
 * @param providers The providers to pull from (a registry is deferred).
 */
export async function reconcileProjectWorkItems(
	handle: DbHandle,
	projectId: string,
	providers: readonly WorkItemProviderLike[],
): Promise<ReconcileResult> {
	const collected = await collectProviderItems(projectId, providers);
	const { upserted } = await reconcileProviderWorkItems(handle.db, projectId, collected);

	return {
		projectId,
		providerCount: providers.length,
		fetched: collected.length,
		upserted,
	};
}
