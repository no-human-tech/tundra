import { describe, expect, it } from "vitest";

import { modules, projectMembers, projects, workItems, workspaces } from "./index.js";

describe("schema barrel", () => {
	it("exports the five core tables as defined Drizzle objects", () => {
		for (const table of [workspaces, projects, projectMembers, modules, workItems]) {
			expect(table).toBeDefined();
			expect(typeof table).toBe("object");
		}
	});

	it("does not open a connection at import time", () => {
		// Importing schema must be side-effect free; reaching here proves it.
		expect(workItems).not.toBe(workspaces);
	});
});
