import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BOARD_CARDS } from "../data/board.js";
import { TaskDrawer } from "./TaskDrawer.js";

const card = BOARD_CARDS[0]!;

describe("TaskDrawer", () => {
	it("renders nothing when no card is selected", () => {
		const { container } = render(
			<TaskDrawer card={undefined} projectName="Aurora Platform" onClose={() => {}} />,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("opens as a labeled dialog showing the card title and the Details tab by default", () => {
		render(<TaskDrawer card={card} projectName="Aurora Platform" onClose={() => {}} />);

		const dialog = screen.getByRole("dialog", { name: card.title });
		expect(dialog).toBeInTheDocument();
		expect(screen.getByText("Status")).toBeInTheDocument();
		// The card's column name appears at least in the drawer subtitle.
		expect(screen.getAllByText(card.column).length).toBeGreaterThan(0);
	});

	it("renders all five tabs and switches to the Activity panel on click", () => {
		render(<TaskDrawer card={card} projectName="Aurora Platform" onClose={() => {}} />);

		expect(screen.getByRole("tab", { name: /details/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /time/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /links/i })).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /automation/i })).toBeInTheDocument();

		fireEvent.click(screen.getByRole("tab", { name: /activity/i }));

		expect(screen.getByRole("tabpanel")).toBeInTheDocument();
	});

	it("calls onClose when the close button is activated", () => {
		const onClose = vi.fn();
		render(<TaskDrawer card={card} projectName="Aurora Platform" onClose={onClose} />);
		fireEvent.click(screen.getByRole("button", { name: /close/i }));
		expect(onClose).toHaveBeenCalledTimes(1);
	});
});
