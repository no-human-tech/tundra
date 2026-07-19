/** Tests for the integration-bus message contract. */

import { describe, expect, it } from "vitest";

import { INBOUND_TOPIC_PREFIX, parseInboundMessage } from "./integration.js";

const VALID = {
	kind: "workitem.upsert",
	projectId: "proj-core",
	externalId: "TICKET-42",
	moduleId: "mod.helpdesk",
	title: "Handle escalation",
};

describe("parseInboundMessage", () => {
	it("accepts a minimal valid upsert", () => {
		const parsed = parseInboundMessage(VALID);
		expect("error" in parsed).toBe(false);
		if ("error" in parsed) return;
		expect(parsed.kind).toBe("workitem.upsert");
		expect(parsed.externalId).toBe("TICKET-42");
		expect(parsed.status).toBeUndefined();
	});

	it("accepts optional fields when well-typed", () => {
		const parsed = parseInboundMessage({
			...VALID,
			status: "in_progress",
			priority: "high",
			assigneeId: "user-ada",
			dueDate: "2026-08-01",
			metadata: { origin: "helpdesk" },
		});
		expect("error" in parsed).toBe(false);
		if ("error" in parsed) return;
		expect(parsed.status).toBe("in_progress");
		expect(parsed.priority).toBe("high");
	});

	it("rejects non-objects, unknown kinds, and missing required fields", () => {
		expect(parseInboundMessage(null)).toHaveProperty("error");
		expect(parseInboundMessage("str")).toHaveProperty("error");
		expect(parseInboundMessage({ ...VALID, kind: "nope" })).toHaveProperty("error");
		expect(parseInboundMessage({ ...VALID, projectId: "" })).toHaveProperty("error");
		expect(parseInboundMessage({ ...VALID, title: undefined })).toHaveProperty("error");
	});

	it("rejects invalid enum values and malformed optionals", () => {
		expect(parseInboundMessage({ ...VALID, status: "sideways" })).toHaveProperty("error");
		expect(parseInboundMessage({ ...VALID, priority: "asap" })).toHaveProperty("error");
		expect(parseInboundMessage({ ...VALID, assigneeId: 42 })).toHaveProperty("error");
		expect(parseInboundMessage({ ...VALID, metadata: "notes" })).toHaveProperty("error");
	});

	it("exposes the inbound topic prefix contract", () => {
		expect(INBOUND_TOPIC_PREFIX).toBe("tundra.integrations.inbound.");
	});
});
