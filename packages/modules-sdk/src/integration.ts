/**
 * Integration-bus contracts — how external systems exchange events with
 * Tundra over the Kafka-compatible bus (Redpanda).
 *
 * Outbound: the host publishes audit-derived domain events to
 * `tundra.events.workitem` / `tundra.events.audit` (relayed from the
 * transactional outbox; at-least-once, keyed by target id).
 *
 * Inbound: external systems publish {@link InboundIntegrationMessage}s to
 * topics under {@link INBOUND_TOPIC_PREFIX}; the worker maps them onto the
 * unified WorkItem model as `extension`-sourced items, which is exactly how
 * they surface in "My Tasks". This module owns the message contract and its
 * validation so integrations and the host agree on one shape — pure types and
 * functions, no I/O, no Kafka client.
 */

import { WorkItemPriority, WorkItemStatus } from "@tundra/domain";

/** Topic prefix external systems publish inbound integration events to. */
export const INBOUND_TOPIC_PREFIX = "tundra.integrations.inbound.";

/** Topic carrying WorkItem lifecycle events out of Tundra. */
export const OUTBOUND_WORKITEM_TOPIC = "tundra.events.workitem";

/** Topic carrying all other audit-derived events out of Tundra. */
export const OUTBOUND_AUDIT_TOPIC = "tundra.events.audit";

/**
 * An inbound "upsert this work item" event from an external system. Repeated
 * deliveries with the same `externalId` are idempotent (the host upserts by
 * the derived WorkItem id), which is required on an at-least-once bus.
 */
export interface InboundWorkItemUpsert {
	kind: "workitem.upsert";
	/** Target Tundra project. */
	projectId: string;
	/** Stable id of the item in the external system (drives idempotency). */
	externalId: string;
	/** Module/integration that owns this item, e.g. "mod.helpdesk". */
	moduleId: string;
	title: string;
	/** Defaults to "todo" when omitted. */
	status?: WorkItemStatus;
	/** Defaults to "medium" when omitted. */
	priority?: WorkItemPriority;
	/** Tundra user the item is assigned to (surfaces in their My Tasks). */
	assigneeId?: string;
	/** ISO date the item is due. */
	dueDate?: string;
	/** Opaque provider payload carried on the WorkItem. */
	metadata?: Record<string, unknown>;
}

/** The (currently single-variant) inbound message union. */
export type InboundIntegrationMessage = InboundWorkItemUpsert;

const STATUS_VALUES = new Set<string>(Object.values(WorkItemStatus));
const PRIORITY_VALUES = new Set<string>(Object.values(WorkItemPriority));

/** Why an inbound payload was rejected. */
export interface InboundParseError {
	error: string;
}

/**
 * Parse and validate a raw inbound message payload (already JSON-decoded).
 *
 * Returns the typed message, or `{ error }` describing the first problem —
 * malformed messages must be rejected (and logged/dead-lettered), never
 * half-applied.
 */
export function parseInboundMessage(raw: unknown): InboundIntegrationMessage | InboundParseError {
	if (typeof raw !== "object" || raw === null) {
		return { error: "payload must be a JSON object" };
	}
	const msg = raw as Record<string, unknown>;

	if (msg["kind"] !== "workitem.upsert") {
		return { error: `unknown kind: ${String(msg["kind"])}` };
	}
	for (const field of ["projectId", "externalId", "moduleId", "title"] as const) {
		if (typeof msg[field] !== "string" || msg[field] === "") {
			return { error: `${field} must be a non-empty string` };
		}
	}
	if (msg["status"] !== undefined && !STATUS_VALUES.has(String(msg["status"]))) {
		return { error: `invalid status: ${String(msg["status"])}` };
	}
	if (msg["priority"] !== undefined && !PRIORITY_VALUES.has(String(msg["priority"]))) {
		return { error: `invalid priority: ${String(msg["priority"])}` };
	}
	for (const field of ["assigneeId", "dueDate"] as const) {
		if (msg[field] !== undefined && typeof msg[field] !== "string") {
			return { error: `${field} must be a string when present` };
		}
	}
	if (
		msg["metadata"] !== undefined &&
		(typeof msg["metadata"] !== "object" || msg["metadata"] === null)
	) {
		return { error: "metadata must be an object when present" };
	}

	return {
		kind: "workitem.upsert",
		projectId: msg["projectId"] as string,
		externalId: msg["externalId"] as string,
		moduleId: msg["moduleId"] as string,
		title: msg["title"] as string,
		status: msg["status"] as WorkItemStatus | undefined,
		priority: msg["priority"] as WorkItemPriority | undefined,
		assigneeId: msg["assigneeId"] as string | undefined,
		dueDate: msg["dueDate"] as string | undefined,
		metadata: msg["metadata"] as Record<string, unknown> | undefined,
	};
}
