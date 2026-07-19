import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "../App.js";
import { renderAtPath } from "./testRouter.js";

describe("Board phase swimlanes", () => {
	it("activating By-phase grouping renders exactly three phase swimlanes", async () => {
		await renderAtPath("/projects/proj-core/board", <App />);

		// Click the "By phase" segmented button.
		const byPhaseBtn = screen.getByRole("button", { name: /by phase/i });
		fireEvent.click(byPhaseBtn);

		// Three swimlane <section> elements labelled with each phase name.
		const lanes = screen.getAllByRole("region");
		const phaseLabels = lanes
			.map((el) => el.getAttribute("aria-label") ?? "")
			.filter((label) => /planning|execution|deployment/i.test(label));

		expect(phaseLabels).toHaveLength(3);
		expect(phaseLabels.some((l) => /planning/i.test(l))).toBe(true);
		expect(phaseLabels.some((l) => /execution/i.test(l))).toBe(true);
		expect(phaseLabels.some((l) => /deployment/i.test(l))).toBe(true);
	});
});
