import { describe, expect, it } from "vitest";

import { MODULE_CATALOG } from "./modules.js";

/**
 * The withdrawn Discussions module (the design spec §6) must never resurface
 * under its own name OR the external forum product's name ("Discourse") it
 * used to integrate with — the catalog now calls that integration "Community
 * Import" (see modules.ts). Checking the raw fixture data catches a
 * regression regardless of which screen ends up rendering it.
 */
describe("MODULE_CATALOG", () => {
	const NO_DISCUSSIONS = /discussion|dyskusj|discourse/i;

	it("never names a module Discussions/Dyskusje/Discourse", () => {
		for (const module of MODULE_CATALOG) {
			expect(module.id).not.toMatch(NO_DISCUSSIONS);
			expect(module.name).not.toMatch(NO_DISCUSSIONS);
			expect(module.description).not.toMatch(NO_DISCUSSIONS);
		}
	});

	it("names the external community-forum integration Community Import", () => {
		const communityImport = MODULE_CATALOG.find((m) => m.id === "mod-community-import");
		expect(communityImport).toBeDefined();
		expect(communityImport?.name).toBe("Community Import");
	});
});
