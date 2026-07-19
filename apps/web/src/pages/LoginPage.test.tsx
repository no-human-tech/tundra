import { fireEvent, screen } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { AuthContextValue } from "../auth/AuthContext.js";
import { renderAtPath } from "../__tests__/testRouter.js";

const mockUseAuth = vi.fn<() => AuthContextValue>();

vi.mock("../auth/AuthContext.js", () => ({
	useAuth: () => mockUseAuth(),
}));

// vi.mock calls are hoisted above imports by Vitest, so LoginPage picks up the
// mocked useAuth even though this import appears after the mock in source order.
import { LoginPage } from "./LoginPage.js";

function stubAuth(overrides: Partial<AuthContextValue>) {
	mockUseAuth.mockReturnValue({
		status: "unauthenticated",
		viewer: null,
		login: vi.fn(async () => ({})),
		register: vi.fn(async () => ({})),
		logout: vi.fn(async () => {}),
		...overrides,
	});
}

function renderAt(path: string) {
	return renderAtPath(
		path,
		<Routes>
			<Route path="/login" element={<LoginPage />} />
			<Route path="/dashboard" element={<div>DASHBOARD ROUTE</div>} />
		</Routes>,
	);
}

describe("LoginPage auth redirect behavior", () => {
	it("shows the login form and does not redirect when unauthenticated", async () => {
		stubAuth({ status: "unauthenticated" });
		await renderAt("/login#login");
		expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
		expect(screen.queryByText("DASHBOARD ROUTE")).not.toBeInTheDocument();
	});

	it("redirects to /dashboard once authenticated", async () => {
		stubAuth({ status: "authenticated" });
		await renderAt("/login#login");
		expect(screen.getByText("DASHBOARD ROUTE")).toBeInTheDocument();
	});

	it("does not redirect an authenticated viewer away from company setup", async () => {
		stubAuth({ status: "authenticated" });
		await renderAt("/login#companysetup");
		expect(screen.queryByText("DASHBOARD ROUTE")).not.toBeInTheDocument();
		expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
	});

	it("shows a closed-registration state on #register, never an active create-account form", async () => {
		stubAuth({ status: "unauthenticated" });
		await renderAt("/login#register");
		expect(screen.queryByRole("textbox", { name: /display name/i })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /create account/i })).not.toBeInTheDocument();
		expect(
			screen.getByRole("heading", { level: 1, name: /registration is closed/i }),
		).toBeInTheDocument();
	});

	it("the closed-registration screen's CTA navigates to login", async () => {
		stubAuth({ status: "unauthenticated" });
		await renderAt("/login#register");
		fireEvent.click(screen.getByRole("button", { name: /go to sign in/i }));
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/welcome back/i);
	});
});

describe("LoginPage — pixel-perfect /login#login layout", () => {
	it("shows the Welcome back title and subtitle, with no visible kicker", async () => {
		stubAuth({ status: "unauthenticated" });
		await renderAt("/login#login");
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back");
		expect(screen.getByText("Sign in to your Tundra workspace.")).toBeInTheDocument();
		expect(screen.queryByText("Welcome back", { selector: ".tnd-kicker" })).not.toBeInTheDocument();
	});

	it("the header carries only the brand, theme toggle and language switcher", async () => {
		stubAuth({ status: "unauthenticated" });
		const { container } = await renderAt("/login#login");
		const header = container.querySelector(".tnd-auth__bar")!;
		expect(header.querySelector("select.tnd-langswitcher")).not.toBeNull();
		expect(screen.getByRole("link", { name: /tundra/i })).toHaveAttribute("href", "/");
	});

	it("hides the OAuth provider row and divider entirely when no provider is configured", async () => {
		stubAuth({ status: "unauthenticated" });
		const { container } = await renderAt("/login#login");
		// This repo's default env has no VITE_*_CLIENT_ID set, so no provider
		// tile — and no "or continue with email" divider — should render.
		expect(container.querySelector(".tnd-oauth-row")).toBeNull();
		expect(container.querySelector(".tnd-auth__divider")).toBeNull();
	});

	it("the forgot-password link sits inline with the password label", async () => {
		stubAuth({ status: "unauthenticated" });
		await renderAt("/login#login");
		fireEvent.click(screen.getByRole("button", { name: /forgot password\?/i }));
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/forgot your password/i);
	});

	it("toggles the password field between hidden and revealed", async () => {
		stubAuth({ status: "unauthenticated" });
		await renderAt("/login#login");
		const passwordInput = screen.getByPlaceholderText("••••••••") as HTMLInputElement;
		expect(passwordInput.type).toBe("password");

		fireEvent.click(screen.getByRole("button", { name: /show password/i }));
		expect(passwordInput.type).toBe("text");

		fireEvent.click(screen.getByRole("button", { name: /hide password/i }));
		expect(passwordInput.type).toBe("password");
	});

	it("the footer 'No account?' link navigates to the closed-registration screen", async () => {
		stubAuth({ status: "unauthenticated" });
		await renderAt("/login#login");
		expect(screen.getByText("No account?")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Create one" }));
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/registration is closed/i);
	});
});
