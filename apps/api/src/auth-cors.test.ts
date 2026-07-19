/**
 * HTTP-level tests for auth endpoint CORS behaviour.
 *
 * These tests call `buildApp().fetch()` directly — no running server, no
 * network. They verify that:
 *  - OPTIONS preflight on /auth/* is answered correctly for allowed origins.
 *  - Disallowed origins do not receive a credentialed CORS echo.
 *  - A successful POST /auth/login returns Set-Cookie.
 *  - The GraphQL endpoint CORS is not broken by the auth CORS addition.
 *  - Wildcard "*" is accepted only in development; it throws in other envs.
 *  - Comma-separated string origins are parsed correctly.
 */

import { describe, expect, it } from "vitest";

import { buildApp } from "./index.js";
import { createContextFactory } from "./context.js";
import { createMockDataSource } from "./data-source/mock.js";

const ALLOWED_ORIGIN = "http://localhost:5174";
const OTHER_ALLOWED = "http://localhost:5173";
const BLOCKED_ORIGIN = "http://evil.example.com";

function makeApp(
	corsOrigin: string | string[] = [OTHER_ALLOWED, ALLOWED_ORIGIN],
	nodeEnv = "development",
) {
	const dataSource = createMockDataSource();
	const contextFactory = createContextFactory(dataSource);
	return buildApp({ contextFactory, corsOrigin, dataSource, nodeEnv });
}

describe("auth CORS — OPTIONS preflight", () => {
	it("OPTIONS /auth/login from allowed origin returns <300 with CORS headers", async () => {
		const app = makeApp();
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/login", {
				method: "OPTIONS",
				headers: {
					Origin: ALLOWED_ORIGIN,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.status).toBeLessThan(300);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it("OPTIONS /auth/register from allowed origin returns CORS headers", async () => {
		const app = makeApp();
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/register", {
				method: "OPTIONS",
				headers: {
					Origin: OTHER_ALLOWED,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.status).toBeLessThan(300);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(OTHER_ALLOWED);
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it("OPTIONS /auth/login from blocked origin does not echo that origin", async () => {
		const app = makeApp();
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/login", {
				method: "OPTIONS",
				headers: {
					Origin: BLOCKED_ORIGIN,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(BLOCKED_ORIGIN);
	});
});

describe("auth CORS — POST /auth/login", () => {
	it("returns 200 + Set-Cookie for valid credentials from allowed origin", async () => {
		const app = makeApp();
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Origin: ALLOWED_ORIGIN,
				},
				body: JSON.stringify({ email: "ada@example.com", password: "password-ada" }),
			}),
		);
		expect(res.status).toBe(200);
		const setCookie = res.headers.get("Set-Cookie");
		expect(setCookie).toBeTruthy();
		expect(setCookie).toContain("tundra.session=");
	});
});

describe("GraphQL CORS — unchanged", () => {
	it("OPTIONS /graphql from allowed origin still returns CORS headers", async () => {
		const app = makeApp();
		const res = await app.fetch(
			new Request("http://localhost:4000/graphql", {
				method: "OPTIONS",
				headers: {
					Origin: ALLOWED_ORIGIN,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.status).toBeLessThan(300);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
		expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
	});

	it("OPTIONS /graphql from blocked origin does not echo that origin", async () => {
		const app = makeApp();
		const res = await app.fetch(
			new Request("http://localhost:4000/graphql", {
				method: "OPTIONS",
				headers: {
					Origin: BLOCKED_ORIGIN,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(BLOCKED_ORIGIN);
	});
});

describe("wildcard CORS policy", () => {
	it("wildcard in development reflects any request origin", async () => {
		const app = makeApp("*", "development");
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/login", {
				method: "OPTIONS",
				headers: {
					Origin: "http://any-origin.example.com",
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe("http://any-origin.example.com");
	});

	it("wildcard outside development throws at buildApp time", () => {
		expect(() => makeApp("*", "production")).toThrow(
			/CORS_ORIGIN="\*" is not allowed outside NODE_ENV=development/,
		);
	});

	it("wildcard outside development throws for test nodeEnv too", () => {
		expect(() => makeApp(["*"], "test")).toThrow(/NODE_ENV=test/);
	});
});

describe("comma-separated string origins", () => {
	it("parses a comma-separated string and allows listed origins", async () => {
		const app = makeApp(`${OTHER_ALLOWED},${ALLOWED_ORIGIN}`);
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/login", {
				method: "OPTIONS",
				headers: {
					Origin: ALLOWED_ORIGIN,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).toBe(ALLOWED_ORIGIN);
	});

	it("comma-separated string blocks origins not in the list", async () => {
		const app = makeApp(`${OTHER_ALLOWED},${ALLOWED_ORIGIN}`);
		const res = await app.fetch(
			new Request("http://localhost:4000/auth/login", {
				method: "OPTIONS",
				headers: {
					Origin: BLOCKED_ORIGIN,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			}),
		);
		expect(res.headers.get("Access-Control-Allow-Origin")).not.toBe(BLOCKED_ORIGIN);
	});
});
