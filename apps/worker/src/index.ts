/**
 * Tundra background worker (architect report 01 §1, §3).
 *
 * FUTURE ROLE — this process owns all async / scheduled work:
 *  - WorkItem provider reconciliation: pull from each registered `WorkItemProvider`
 *    (bugs, reviews, docs follow-ups, extensions) and materialize them into the
 *    unified WorkItem read model, idempotently (no duplicates on re-run).
 *  - Automation actions: execute automation-generated actions and emit WorkItems.
 *  - Notification fan-out.
 *  - Report rollups (velocity, burndown, time summary, throughput).
 *
 * THIS PHASE: the queue exists and a single job kind — WorkItem reconciliation —
 * is handled end-to-end via `reconcileProjectWorkItems` (see `./reconcile.ts`),
 * which calls `@tundra/db`'s idempotent upsert. The Redis connection is opened
 * only by `startWorker`, and the Postgres handle only when `config.dataSource`
 * is `db`; neither is touched at import time (see the entry guard).
 *
 * DEFERRED: provider registry, scheduling, retry/backoff (see `./reconcile.ts`).
 */

import { Queue, Worker } from "bullmq";
import type { Job } from "bullmq";
import { createDbClient } from "@tundra/db";
import type { DbHandle } from "@tundra/db";
import { loadConfig, redisConnectionOptions } from "@tundra/config";
import type { AppConfig } from "@tundra/config";

import { reconcileProjectWorkItems } from "./reconcile.js";
import type { WorkItemProviderLike } from "./reconcile.js";
import { startIntegrationBus } from "./integration-bus.js";
import type { IntegrationBusHandle } from "./integration-bus.js";

/** The queue future WorkItem materialization / automation jobs flow through. */
export const WORKITEMS_QUEUE = "tundra.workitems";

/** Job name for a WorkItem provider-reconciliation pass. */
export const RECONCILE_JOB = "workitems.reconcile";

/** Payload for a {@link RECONCILE_JOB}. */
export interface ReconcileJobData {
	projectId: string;
}

export interface WorkerHandle {
	queue: Queue;
	worker: Worker;
	/** Gracefully close the worker, queue, integration bus, and db connections. */
	close(): Promise<void>;
}

/**
 * The job processor. WorkItem reconciliation runs against Postgres when a db
 * handle is available; without one (mock mode) it logs and no-ops so the worker
 * still runs in a DB-less dev setup.
 *
 * The provider registry is deferred, so reconciliation currently runs with an
 * empty provider list — a structurally-correct pass that upserts nothing. Wiring
 * real `WorkItemProvider` contributions in is the next step.
 */
async function processJob(job: Job, db: DbHandle | null): Promise<void> {
	if (job.name === RECONCILE_JOB) {
		const { projectId } = job.data as ReconcileJobData;
		if (!db) {
			console.log(`[worker] reconcile skipped for ${projectId}: no db (mock mode)`);
			return;
		}
		const providers: WorkItemProviderLike[] = []; // DEFERRED: real provider registry.
		const result = await reconcileProjectWorkItems(db, projectId, providers);
		console.log(
			`[worker] reconciled project ${result.projectId}: ` +
				`${result.upserted} upserted from ${result.providerCount} provider(s)`,
		);
		return;
	}

	console.log(`[worker] received unhandled job ${job.id ?? "?"} (${job.name})`);
}

/**
 * Construct and start the worker. Opens a Redis connection (and, in db mode, a
 * Postgres pool) — call from app startup only, never at import.
 */
export function startWorker(config: AppConfig = loadConfig()): WorkerHandle {
	// Plain host/port in dev; Sentinel options (client-side failover) when
	// REDIS_SENTINEL_ADDRS is configured — BullMQ passes these to ioredis.
	const connection = redisConnectionOptions(config.redis);
	const db: DbHandle | null =
		config.dataSource === "db" ? createDbClient(config.postgres.databaseUrl) : null;

	const queue = new Queue(WORKITEMS_QUEUE, { connection });

	const worker = new Worker(WORKITEMS_QUEUE, (job: Job) => processJob(job, db), {
		connection,
		concurrency: config.worker.concurrency,
	});

	// The integration bus (outbox relay + inbound consumer) needs both the bus
	// config and a real database; self-hosted profiles without Redpanda run
	// queue-only.
	let bus: Promise<IntegrationBusHandle> | null = null;
	if (config.redpanda.enabled && db) {
		bus = startIntegrationBus(config.redpanda, db).catch((err) => {
			console.error("[worker] integration bus failed to start:", err);
			return { close: async () => undefined };
		});
	}

	console.log(
		`Tundra worker listening on queue "${WORKITEMS_QUEUE}" ` +
			`(concurrency ${config.worker.concurrency}, data source ${config.dataSource}, ` +
			`integration bus ${config.redpanda.enabled && db ? "on" : "off"})`,
	);

	return {
		queue,
		worker,
		close: async () => {
			if (bus) {
				await (await bus).close();
			}
			await worker.close();
			await queue.close();
			if (db) {
				await db.close();
			}
		},
	};
}

// Entry guard: only connect to Redis/Postgres when run directly (not imported).
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
	const handle = startWorker();

	// Graceful shutdown: BullMQ's worker.close() waits for in-flight jobs, so a
	// k8s rolling update never kills a reconciliation mid-write.
	let shuttingDown = false;
	const shutdown = (signal: string): void => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`Tundra worker received ${signal}, shutting down...`);
		handle
			.close()
			.then(() => process.exit(0))
			.catch(() => process.exit(1));
		setTimeout(() => process.exit(1), 25_000).unref();
	};
	process.once("SIGTERM", () => shutdown("SIGTERM"));
	process.once("SIGINT", () => shutdown("SIGINT"));
}
