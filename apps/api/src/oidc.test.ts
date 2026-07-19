/**
 * Tests for the OIDC login module.
 *
 * Pure-function coverage (transaction cookie signing, role mapping) plus
 * HTTP-level route tests via `buildApp().fetch()` with a stubbed
 * {@link OidcAuth} port — no IdP, no network.
 */

import { describe, expect, it } from "vitest";

import { buildApp } from "./index.js";
import { createContextFactory } from "./context.js";
import { createMockDataSource } from "./data-source/mock.js";
import type { OidcAuth, OidcLoginProfile } from "./oidc.js";
import { OIDC_TXN_COOKIE_NAME, mapIdpRoles, signTransaction, verifyTransaction } from "./oidc.js";

const SECRET = "test-oidc-client-secret";
const FRONTEND = "http://localhost:5173";

const TXN = { state: "st4te", nonce: "n0nce", verifier: "v3rifier" };

describe("signTransaction / verifyTransaction", () => {
	it("round-trips a transaction", () => {
		const value = signTransaction(TXN, SECRET);
		expect(verifyTransaction(value, SECRET)).toEqual(TXN);
	});

	it("rejects null, malformed, and tampered values", () => {
		expect(verifyTransaction(null, SECRET)).toBeNull();
		expect(verifyTransaction("garbage", SECRET)).toBeNull();
		expect(verifyTransaction("a.b", SECRET)).toBeNull();

		const value = signTransaction(TXN, SECRET);
		const [payload, ts, hmac] = value.split(".") as [string, string, string];
		const forged = Buffer.from(JSON.stringify({ ...TXN, state: "evil" })).toString("base64url");
		expect(verifyTransaction(`${forged}.${ts}.${hmac}`, SECRET)).toBeNull();
		expect(verifyTransaction(`${payload}.${ts}.${"0".repeat(64)}`, SECRET)).toBeNull();
	});

	it("rejects a signature made with a different secret", () => {
		const value = signTransaction(TXN, "other-secret");
		expect(verifyTransaction(value, SECRET)).toBeNull();
	});

	it("rejects an expired transaction (10 minute TTL)", () => {
		const issued = Date.now();
		const value = signTransaction(TXN, SECRET, issued);
		expect(verifyTransaction(value, SECRET, issued + 9 * 60 * 1000)).toEqual(TXN);
		expect(verifyTransaction(value, SECRET, issued + 11 * 60 * 1000)).toBeNull();
	});
});

describe("mapIdpRoles", () => {
	it("maps the admin client role to admin", () => {
		expect(mapIdpRoles(["admin"], [])).toBe("admin");
		expect(mapIdpRoles(["user", "admin"], [])).toBe("admin");
	});

	it("maps the admin group path to admin", () => {
		expect(mapIdpRoles([], ["/organizacje/no-human/tundra/admin"])).toBe("admin");
	});

	it("maps everything else to member", () => {
		expect(mapIdpRoles(["user"], [])).toBe("member");
		expect(mapIdpRoles([], ["/organizacje/no-human/tundra/user"])).toBe("member");
		expect(mapIdpRoles([], [])).toBe("member");
	});
});

/** Stub OidcAuth: /start yields a fixed URL; /callback yields the given result. */
function stubOidcAuth(callbackResult: OidcLoginProfile | { error: "oidc_txn_invalid" }): OidcAuth {
	return {
		async start() {
			return {
				authorizationUrl: "https://idp.example.com/auth?client_id=tundra",
				txnCookieValue: signTransaction(TXN, SECRET),
			};
		},
		async callback() {
			return callbackResult;
		},
		async endSessionUrl(postLogoutRedirect: string) {
			return `https://idp.example.com/logout?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirect)}`;
		},
	};
}

function makeApp(oidcAuth?: OidcAuth, localAuthEnabled?: boolean) {
	const dataSource = createMockDataSource();
	const contextFactory = createContextFactory(dataSource);
	return buildApp({
		contextFactory,
		corsOrigin: [FRONTEND],
		dataSource,
		oidcAuth,
		localAuthEnabled,
		frontendUrl: FRONTEND,
	});
}

describe("GET /auth/oidc/start", () => {
	it("503s when OIDC is not configured", async () => {
		const app = makeApp(undefined);
		const res = await app.fetch(new Request("http://localhost:4000/auth/oidc/start"));
		expect(res.status).toBe(503);
	});

	it("redirects to the IdP and sets the transaction cookie", async () => {
		const app = makeApp(
			stubOidcAuth({ subject: "s", verifiedEmail: null, name: null, workspaceRole: "member" }),
		);
		const res = await app.fetch(new Request("http://localhost:4000/auth/oidc/start"));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toContain("https://idp.example.com/auth");
		const cookie = res.headers.get("Set-Cookie") ?? "";
		expect(cookie).toContain(`${OIDC_TXN_COOKIE_NAME}=`);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Path=/auth/oidc");
	});
});

describe("GET /auth/oidc/callback", () => {
	it("opens a session and redirects to the dashboard on success", async () => {
		const app = makeApp(
			stubOidcAuth({
				subject: "kc-sub-1",
				verifiedEmail: "ada@example.com",
				name: "Ada",
				workspaceRole: "admin",
			}),
		);
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/oidc/callback?code=x&state=st4te"),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe(`${FRONTEND}/dashboard`);
		const cookies = res.headers.getSetCookie();
		expect(cookies.some((c) => c.startsWith("tundra.session="))).toBe(true);
		// The transaction cookie is cleared on every outcome.
		expect(cookies.some((c) => c.startsWith(`${OIDC_TXN_COOKIE_NAME}=;`))).toBe(true);
	});

	it("redirects back to /login with a generic error on failure", async () => {
		const app = makeApp(stubOidcAuth({ error: "oidc_txn_invalid" }));
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/oidc/callback?code=x&state=bad"),
		);
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe(`${FRONTEND}/login?error=sso_failed`);
		const cookies = res.headers.getSetCookie();
		expect(cookies.some((c) => c.startsWith("tundra.session="))).toBe(false);
	});
});

describe("GET /auth/oidc/logout", () => {
	it("clears the session cookie and redirects to the IdP end-session URL", async () => {
		const app = makeApp(
			stubOidcAuth({ subject: "s", verifiedEmail: null, name: null, workspaceRole: "member" }),
		);
		const res = await app.fetch(new Request("http://localhost:4000/auth/oidc/logout"));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toContain("https://idp.example.com/logout");
		expect(res.headers.get("Set-Cookie")).toContain("tundra.session=;");
	});

	it("falls back to /login when OIDC is not configured", async () => {
		const app = makeApp(undefined);
		const res = await app.fetch(new Request("http://localhost:4000/auth/oidc/logout"));
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toBe(`${FRONTEND}/login`);
	});
});

describe("localAuthEnabled=false (OIDC-only production profile)", () => {
	it("503s register and login but leaves logout available", async () => {
		const app = makeApp(undefined, false);

		const register = await app.fetch(
			new Request("http://localhost:4000/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "a@b.c", password: "12345678", displayName: "A" }),
			}),
		);
		expect(register.status).toBe(503);

		const login = await app.fetch(
			new Request("http://localhost:4000/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: "a@b.c", password: "12345678" }),
			}),
		);
		expect(login.status).toBe(503);

		const logout = await app.fetch(
			new Request("http://localhost:4000/auth/logout", { method: "POST" }),
		);
		expect(logout.status).toBe(200);
	});
});
