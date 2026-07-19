/**
 * Single-use nonce consumption for OAuth/OIDC state tokens.
 *
 * A nonce may be consumed exactly once within its TTL. The in-memory store
 * matches the original single-process behaviour; the Redis store extends the
 * guarantee across API replicas (HA), using `SET NX PX` so consumption is one
 * atomic round trip.
 */

/** Consumes nonces exactly once within a TTL window. */
export interface NonceStore {
	/**
	 * Atomically consume `key`. Returns true when this call was the first use
	 * within the TTL; false when the nonce was already consumed (replay).
	 */
	consume(key: string, ttlMs: number): Promise<boolean>;
}

/** Per-process store — single-use holds within one replica only (dev default). */
export function createInMemoryNonceStore(): NonceStore {
	const used = new Set<string>();
	return {
		async consume(key: string, ttlMs: number): Promise<boolean> {
			if (used.has(key)) {
				return false;
			}
			used.add(key);
			setTimeout(() => used.delete(key), ttlMs).unref?.();
			return true;
		},
	};
}

/**
 * The minimal Redis surface the store needs (ioredis-compatible `SET NX PX`).
 * Typed structurally so the API does not couple to a specific client class.
 */
export interface RedisLike {
	set(key: string, value: string, px: "PX", ttlMs: number, nx: "NX"): Promise<"OK" | null>;
}

/** Redis-backed store — single-use holds across all API replicas. */
export function createRedisNonceStore(redis: RedisLike, keyPrefix = "tundra:nonce:"): NonceStore {
	return {
		async consume(key: string, ttlMs: number): Promise<boolean> {
			const result = await redis.set(`${keyPrefix}${key}`, "1", "PX", ttlMs, "NX");
			return result === "OK";
		},
	};
}
