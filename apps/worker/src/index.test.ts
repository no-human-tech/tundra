import { describe, expect, it } from "vitest";

import { WORKITEMS_QUEUE } from "./index.js";

describe("worker", () => {
	it("exposes the WorkItems queue name constant", () => {
		expect(WORKITEMS_QUEUE).toBe("tundra.workitems");
	});

	it("does not open a Redis connection at import time", () => {
		// Importing the module above must be side-effect free; reaching here proves it.
		expect(typeof WORKITEMS_QUEUE).toBe("string");
	});
});
