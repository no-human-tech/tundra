import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { NewProjectModal } from "./NewProjectModal.js";

describe("NewProjectModal — Create validation", () => {
	it("Create is disabled when the name is empty", () => {
		render(<NewProjectModal open onClose={() => {}} onCreate={() => {}} />);
		expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
	});

	it("Create stays disabled with a name but no included Project Manager", () => {
		render(<NewProjectModal open onClose={() => {}} onCreate={() => {}} />);

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nebula Ops" } });
		expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

		// Include a member without changing their role away from the default
		// (non-PM) role — still no included Project Manager.
		fireEvent.click(screen.getByRole("checkbox", { name: "Include Mira Lindqvist" }));
		expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
		expect(
			screen.getByText("At least one included member must be a Project Manager."),
		).toBeInTheDocument();
	});

	it("Create becomes enabled once a name is set and an included member is a Project Manager", () => {
		render(<NewProjectModal open onClose={() => {}} onCreate={() => {}} />);

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nebula Ops" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "Include Mira Lindqvist" }));

		const roleSelect = screen.getByRole("combobox", { name: "Role for Mira Lindqvist" });
		fireEvent.change(roleSelect, { target: { value: "Project Manager" } });

		expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
		expect(
			screen.queryByText("At least one included member must be a Project Manager."),
		).not.toBeInTheDocument();
	});

	it("calls onCreate with a project built from the form once Create is activated", () => {
		const onCreate = vi.fn();
		render(<NewProjectModal open onClose={() => {}} onCreate={onCreate} />);

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nebula Ops" } });
		fireEvent.click(screen.getByRole("checkbox", { name: "Include Mira Lindqvist" }));
		fireEvent.change(screen.getByRole("combobox", { name: "Role for Mira Lindqvist" }), {
			target: { value: "Project Manager" },
		});

		fireEvent.click(screen.getByRole("button", { name: "Create" }));

		expect(onCreate).toHaveBeenCalledTimes(1);
		const project = onCreate.mock.calls[0]![0];
		expect(project.name).toBe("Nebula Ops");
		expect(project.memberCount).toBe(1);
		expect(typeof project.id).toBe("string");
		expect(project.id.length).toBeGreaterThan(0);
	});

	it("Cancel calls onClose without calling onCreate", () => {
		const onClose = vi.fn();
		const onCreate = vi.fn();
		render(<NewProjectModal open onClose={onClose} onCreate={onCreate} />);

		fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Nebula Ops" } });
		fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(onCreate).not.toHaveBeenCalled();
	});

	it("renders nothing when closed", () => {
		const { container } = render(
			<NewProjectModal open={false} onClose={() => {}} onCreate={() => {}} />,
		);
		expect(container).toBeEmptyDOMElement();
	});
});
