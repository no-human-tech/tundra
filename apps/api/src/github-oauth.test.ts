/**
 * Unit tests for the GitHub OAuth state helpers in ./github-oauth.ts.
 *
 * These tests cover state generation, validation, replay prevention, and the
 * error paths. They do NOT make real HTTP calls to GitHub — the exchange /
 * profile functions are integration-tested manually or in E2E tests.
 */

import { describe, expect, it } from "vitest";

import { generateState, validateState } from "./github-oauth.js";
import { createTestHarness } from "./test-helpers.js";

const SECRET = "test-secret-for-unit-tests";

describe("generateState", () => {
	it("returns a string with three dot-separated parts", () => {
		const state = generateState(SECRET);
		const parts = state.split(".");
		expect(parts).toHaveLength(3);
	});

	it("produces a 32-char hex nonce, numeric timestamp, and 64-char hex HMAC", () => {
		const state = generateState(SECRET);
		const [nonce, ts, hmac] = state.split(".") as [string, string, string];
		expect(nonce).toMatch(/^[0-9a-f]{32}$/);
		expect(Number(ts)).toBeGreaterThan(0);
		expect(hmac).toMatch(/^[0-9a-f]{64}$/);
	});

	it("produces a different nonce each call", () => {
		const a = generateState(SECRET);
		const b = generateState(SECRET);
		expect(a).not.toBe(b);
	});
});

describe("validateState", () => {
	it("returns null for a freshly-generated state", async () => {
		const state = generateState(SECRET);
		expect(await validateState(state, SECRET)).toBeNull();
	});

	it("returns already_used when the same state is validated twice", async () => {
		const state = generateState(SECRET);
		expect(await validateState(state, SECRET)).toBeNull();
		expect(await validateState(state, SECRET)).toBe("already_used");
	});

	it("returns invalid_format when the state has wrong segment count", async () => {
		expect(await validateState("onlyone", SECRET)).toBe("invalid_format");
		expect(await validateState("two.parts", SECRET)).toBe("invalid_format");
		expect(await validateState("a.b.c.d", SECRET)).toBe("invalid_format");
	});

	it("returns expired for a state with a far-past timestamp", async () => {
		// Manually craft a state with a timestamp from 16 minutes ago.
		const nonce = "a".repeat(32);
		const ts = String(Math.floor(Date.now() / 1000) - 16 * 60);
		// HMAC won't match but we expect the expiry check to fail first.
		const state = `${nonce}.${ts}.` + "f".repeat(64);
		expect(await validateState(state, SECRET)).toBe("expired");
	});

	it("returns invalid_hmac when the HMAC is tampered", async () => {
		const state = generateState(SECRET);
		const parts = state.split(".");
		// Flip the last character of the HMAC.
		const tampered =
			parts[0] +
			"." +
			parts[1] +
			"." +
			(parts[2]!.slice(0, -1) + (parts[2]!.endsWith("a") ? "b" : "a"));
		expect(await validateState(tampered, SECRET)).toBe("invalid_hmac");
	});

	it("returns invalid_hmac when the HMAC has the wrong length", async () => {
		const state = generateState(SECRET);
		const parts = state.split(".");
		const short = parts[0] + "." + parts[1] + ".abcd1234";
		expect(await validateState(short, SECRET)).toBe("invalid_hmac");
	});

	it("returns invalid_hmac when a different secret is used", async () => {
		const state = generateState(SECRET);
		expect(await validateState(state, "wrong-secret")).toBe("invalid_hmac");
	});
});

describe("loginWithGitHub via mock data source (email semantics)", () => {
	it("with verifiedEmail=null creates a new user (no email-match attempted)", async () => {
		const harness = createTestHarness();
		const result = await harness.dataSource.loginWithGitHub({
			githubUserId: "gh-99",
			githubLogin: "octocat",
			githubName: "Octocat",
			verifiedEmail: null,
		});
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		// The stub returns a fresh userId — not a fixture user.
		expect(result.userId).toContain("github_");
		expect(result.sessionToken).toBeTruthy();
	});

	it("with verifiedEmail set returns a result (linked or new user)", async () => {
		const harness = createTestHarness();
		const result = await harness.dataSource.loginWithGitHub({
			githubUserId: "gh-100",
			githubLogin: "auser",
			githubName: "A User",
			verifiedEmail: "auser@example.com",
		});
		expect("error" in result).toBe(false);
		if ("error" in result) return;
		expect(result.sessionToken).toBeTruthy();
	});
});
