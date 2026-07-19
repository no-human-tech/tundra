/**
 * Tests for single-use nonce stores and the production context-factory
 * behaviour that depends on them (dev-header cutoff).
 */

import { describe, expect, it } from "vitest";

import { createContextFactory } from "./context.js";
import { createMockDataSource } from "./data-source/mock.js";
import { DEV_USER_HEADER } from "./session.js";
import type { RedisLike } from "./nonce-store.js";
import { createInMemoryNonceStore, createRedisNonceStore } from "./nonce-store.js";

describe("createInMemoryNonceStore", () => {
	it("consumes a nonce exactly once", async () => {
		const store = createInMemoryNonceStore();
		expect(await store.consume("k1", 60_000)).toBe(true);
		expect(await store.consume("k1", 60_000)).toBe(false);
		expect(await store.consume("k2", 60_000)).toBe(true);
	});
});

describe("createRedisNonceStore", () => {
	it("maps SET NX results to consumption outcomes and prefixes keys", async () => {
		const seen: string[] = [];
		const keys = new Set<string>();
		const fakeRedis: RedisLike = {
			async set(key, _value, _px, _ttl, _nx) {
				seen.push(key);
				if (keys.has(key)) return null;
				keys.add(key);
				return "OK";
			},
		};
		const store = createRedisNonceStore(fakeRedis);
		expect(await store.consume("abc", 1000)).toBe(true);
		expect(await store.consume("abc", 1000)).toBe(false);
		expect(seen[0]).toBe("tundra:nonce:abc");
	});
});

describe("createContextFactory dev-fallback cutoff", () => {
	it("resolves the dev header when the fallback is allowed (default)", async () => {
		const factory = createContextFactory(createMockDataSource());
		const ctx = await factory(
			new Request("http://localhost:4000/graphql", {
				headers: { [DEV_USER_HEADER]: "user-bob" },
			}),
		);
		expect(ctx.sessionSource).toBe("dev-fallback");
		expect(ctx.principal.userId).toBe("user-bob");
	});

	it("returns an anonymous principal when the fallback is disabled (production)", async () => {
		const factory = createContextFactory(createMockDataSource(), { allowDevFallback: false });
		const ctx = await factory(
			new Request("http://localhost:4000/graphql", {
				headers: { [DEV_USER_HEADER]: "user-ada" },
			}),
		);
		expect(ctx.sessionSource).toBe("anonymous");
		expect(ctx.principal.userId).toBeUndefined();
		expect(ctx.principal.permissions).toEqual([]);
	});
});
