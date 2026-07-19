/**
 * Integration bus (Redpanda/Kafka) — the worker's two jobs on it:
 *
 *  1. OUTBOX RELAY: poll `integration_outbox` for unpublished rows and produce
 *     them to their topics, stamping `published_at` on confirmation.
 *     At-least-once — a crash between produce and stamp re-sends the row, so
 *     downstream consumers key on the row id.
 *  2. INBOUND CONSUMER: subscribe to `tundra.integrations.inbound.*`, validate
 *     each message against the `@tundra/modules-sdk` contract, and upsert it
 *     into the unified WorkItem read model as an `extension`-sourced item
 *     (idempotent by derived WorkItem id) — so external systems' items land in
 *     "My Tasks" like any other source.
 *
 * The bus is optional: without `REDPANDA_*` config the worker runs queue-only
 * (self-hosted profile). SASL/SCRAM-SHA-512 matches the cluster's Kafka API.
 */

import { Kafka, logLevel } from "kafkajs";
import type { Consumer, Producer } from "kafkajs";
import {
	markOutboxFailed,
	markOutboxPublished,
	reconcileProviderWorkItems,
	selectPendingOutbox,
} from "@tundra/db";
import type { DbHandle, OutboxRow } from "@tundra/db";
import { WorkItemPriority, WorkItemSource, WorkItemStatus } from "@tundra/domain";
import type { ModuleId, ProjectId, UserId, WorkItem, WorkItemId } from "@tundra/domain";
import { INBOUND_TOPIC_PREFIX, parseInboundMessage } from "@tundra/modules-sdk";
import type { InboundWorkItemUpsert } from "@tundra/modules-sdk";
import type { RedpandaConfig } from "@tundra/config";

/** How often the relay polls for unpublished outbox rows. */
const RELAY_INTERVAL_MS = 5_000;

/** Max rows relayed per poll. */
const RELAY_BATCH_SIZE = 100;

/**
 * Kafka consumer group for the inbound integration consumer. Must stay under
 * the `tundra.` prefix — the cluster ACL for the tundra SASL user covers
 * topics AND consumer groups by that prefix only.
 */
const INBOUND_GROUP_ID = "tundra.worker.integrations";

/**
 * Map a validated inbound upsert onto the unified WorkItem model.
 *
 * The WorkItem id is derived from `(moduleId, externalId)`, so repeated
 * deliveries of the same external item update one row (idempotent on an
 * at-least-once bus). Pure — unit-testable without Kafka or a DB.
 */
export function mapInboundToWorkItem(msg: InboundWorkItemUpsert): WorkItem {
	const now = new Date().toISOString();
	return {
		id: `wi-ext-${msg.moduleId}-${msg.externalId}` as WorkItemId,
		projectId: msg.projectId as ProjectId,
		source: WorkItemSource.Extension,
		sourceRef: {
			source: WorkItemSource.Extension,
			refId: msg.externalId,
			moduleId: msg.moduleId as ModuleId,
		},
		title: msg.title,
		status: msg.status ?? WorkItemStatus.Todo,
		priority: msg.priority ?? WorkItemPriority.Medium,
		assigneeId: msg.assigneeId as UserId | undefined,
		dueDate: msg.dueDate,
		metadata: msg.metadata,
		createdAt: now,
		updatedAt: now,
	};
}

/** Group outbox rows by destination topic, preserving order within each topic. */
export function groupByTopic(rows: readonly OutboxRow[]): Map<string, OutboxRow[]> {
	const byTopic = new Map<string, OutboxRow[]>();
	for (const row of rows) {
		const bucket = byTopic.get(row.topic);
		if (bucket) {
			bucket.push(row);
		} else {
			byTopic.set(row.topic, [row]);
		}
	}
	return byTopic;
}

export interface IntegrationBusHandle {
	/** Stop the relay loop and disconnect producer/consumer. */
	close(): Promise<void>;
}

/**
 * Start the integration bus: connect the producer, begin the outbox relay
 * loop, and subscribe the inbound consumer. Call only from worker startup
 * with a real db handle; never at import time.
 */
export async function startIntegrationBus(
	config: RedpandaConfig,
	db: DbHandle,
): Promise<IntegrationBusHandle> {
	const kafka = new Kafka({
		clientId: "tundra-worker",
		brokers: config.brokers.map((b) => `${b.host}:${b.port}`),
		sasl: {
			mechanism: "scram-sha-512",
			username: config.saslUsername,
			password: config.saslPassword,
		},
		logLevel: logLevel.WARN,
	});

	const producer: Producer = kafka.producer();
	await producer.connect();

	// --- Outbox relay ------------------------------------------------------------

	let relaying = false;
	const relayOnce = async (): Promise<void> => {
		if (relaying) return; // never overlap two polls
		relaying = true;
		try {
			const pending = await selectPendingOutbox(db.db, RELAY_BATCH_SIZE);
			for (const [topic, rows] of groupByTopic(pending)) {
				try {
					await producer.send({
						topic,
						messages: rows.map((row) => ({
							key: row.key ?? undefined,
							value: JSON.stringify({ id: row.id, ...row.payload }),
						})),
					});
					await markOutboxPublished(
						db.db,
						rows.map((row) => row.id),
					);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					console.error(`[worker] outbox relay failed for topic ${topic}: ${message}`);
					for (const row of rows) {
						await markOutboxFailed(db.db, row.id, message);
					}
				}
			}
		} catch (err) {
			console.error("[worker] outbox poll failed:", err);
		} finally {
			relaying = false;
		}
	};
	const relayTimer = setInterval(() => void relayOnce(), RELAY_INTERVAL_MS);

	// --- Inbound consumer ----------------------------------------------------------

	const consumer: Consumer = kafka.consumer({ groupId: INBOUND_GROUP_ID });
	await consumer.connect();
	// Topic auto-create is off cluster-wide; inbound topics are provisioned
	// explicitly per integration, and the regex picks up new ones on rebalance.
	await consumer.subscribe({
		topics: [new RegExp(`^${INBOUND_TOPIC_PREFIX.replace(/\./g, "\\.")}`)],
	});
	await consumer.run({
		eachMessage: async ({ topic, message }) => {
			let raw: unknown;
			try {
				raw = JSON.parse(message.value?.toString() ?? "");
			} catch {
				console.error(`[worker] inbound ${topic}: message is not valid JSON, skipping`);
				return;
			}
			const parsed = parseInboundMessage(raw);
			if ("error" in parsed) {
				console.error(`[worker] inbound ${topic}: rejected message: ${parsed.error}`);
				return;
			}
			const workItem = mapInboundToWorkItem(parsed);
			await reconcileProviderWorkItems(db.db, parsed.projectId, [workItem]);
			console.log(
				`[worker] inbound ${topic}: upserted ${workItem.id} (project ${parsed.projectId})`,
			);
		},
	});

	console.log(
		`Tundra worker integration bus up: relay every ${RELAY_INTERVAL_MS}ms, ` +
			`inbound group "${INBOUND_GROUP_ID}" on ${INBOUND_TOPIC_PREFIX}*`,
	);

	return {
		close: async () => {
			clearInterval(relayTimer);
			// One final drain so a clean shutdown does not strand confirmed work.
			await relayOnce().catch(() => undefined);
			await consumer.disconnect().catch(() => undefined);
			await producer.disconnect().catch(() => undefined);
		},
	};
}
