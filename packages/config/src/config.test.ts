import { describe, expect, it } from "vitest";

import { loadConfig, redisConnectionOptions } from "./index.js";

describe("loadConfig", () => {
	it("parses an empty env into the documented defaults", () => {
		const config = loadConfig({});

		expect(config.nodeEnv).toBe("development");
		expect(config.dataSource).toBe("mock");
		expect(config.api).toEqual({
			host: "0.0.0.0",
			port: 4000,
			graphqlPath: "/graphql",
			corsOrigin: ["http://localhost:5173", "http://localhost:5174"],
		});
		expect(config.web).toEqual({ apiUrl: "http://localhost:4000/graphql" });
		expect(config.worker).toEqual({ concurrency: 5 });
		expect(config.postgres.databaseUrl).toBe("postgres://tundra:tundra@localhost:5432/tundra");
		expect(config.postgres.port).toBe(5432);
		expect(config.redis).toEqual({
			redisUrl: "redis://localhost:6379",
			host: "localhost",
			port: 6379,
			sentinelAddrs: [],
			sentinelMaster: "redis-master",
			password: "",
		});
		expect(config.logging.level).toBe("info");
	});

	it("overrides defaults from provided env values and coerces numeric ports", () => {
		const config = loadConfig({
			API_PORT: "8080",
			WORKER_CONCURRENCY: "12",
			LOG_LEVEL: "debug",
			DATABASE_URL: "postgres://x:y@db:5432/z",
		});

		expect(config.api.port).toBe(8080);
		expect(config.worker.concurrency).toBe(12);
		expect(config.logging.level).toBe("debug");
		expect(config.postgres.databaseUrl).toBe("postgres://x:y@db:5432/z");
	});

	it("selects the db data source and a custom CORS origin", () => {
		const config = loadConfig({
			TUNDRA_DATA_SOURCE: "db",
			CORS_ORIGIN: "https://app.example.com",
		});

		expect(config.dataSource).toBe("db");
		expect(config.api.corsOrigin).toEqual(["https://app.example.com"]);
	});

	it("throws on an unknown data source", () => {
		expect(() => loadConfig({ TUNDRA_DATA_SOURCE: "sqlite" })).toThrow(
			/Invalid Tundra environment configuration/,
		);
	});

	it("returns a deeply frozen object", () => {
		const config = loadConfig({});
		expect(Object.isFrozen(config)).toBe(true);
		expect(Object.isFrozen(config.api)).toBe(true);
	});

	it("throws an aggregated error on an out-of-range port", () => {
		expect(() => loadConfig({ API_PORT: "99999" })).toThrow(
			/Invalid Tundra environment configuration/,
		);
	});

	it("throws on a non-numeric port", () => {
		expect(() => loadConfig({ API_PORT: "not-a-number" })).toThrow(
			/Invalid Tundra environment configuration/,
		);
	});

	it("throws on an unknown log level", () => {
		expect(() => loadConfig({ LOG_LEVEL: "verbose" })).toThrow(
			/Invalid Tundra environment configuration/,
		);
	});

	it("defaults AUTH_LOCAL_ENABLED to enabled and accepts true/false case-insensitively", () => {
		expect(loadConfig({}).auth.localEnabled).toBe(true);
		expect(loadConfig({ AUTH_LOCAL_ENABLED: "false" }).auth.localEnabled).toBe(false);
		expect(loadConfig({ AUTH_LOCAL_ENABLED: "False" }).auth.localEnabled).toBe(false);
		expect(loadConfig({ AUTH_LOCAL_ENABLED: "TRUE" }).auth.localEnabled).toBe(true);
	});

	it("throws on an AUTH_LOCAL_ENABLED value that is not true/false (typo protection)", () => {
		expect(() => loadConfig({ AUTH_LOCAL_ENABLED: "0" })).toThrow(
			/Invalid Tundra environment configuration/,
		);
		expect(() => loadConfig({ AUTH_LOCAL_ENABLED: "no" })).toThrow(
			/Invalid Tundra environment configuration/,
		);
	});

	it("defaults RUN_MIGRATIONS_ON_START by NODE_ENV and accepts an explicit override", () => {
		expect(loadConfig({}).postgres.runMigrationsOnStart).toBe(true);
		expect(loadConfig({ NODE_ENV: "production" }).postgres.runMigrationsOnStart).toBe(false);
		expect(
			loadConfig({ NODE_ENV: "production", RUN_MIGRATIONS_ON_START: "true" }).postgres
				.runMigrationsOnStart,
		).toBe(true);
		expect(loadConfig({ RUN_MIGRATIONS_ON_START: "False" }).postgres.runMigrationsOnStart).toBe(
			false,
		);
	});

	it("throws on a RUN_MIGRATIONS_ON_START value that is not true/false (typo protection)", () => {
		expect(() => loadConfig({ RUN_MIGRATIONS_ON_START: "1" })).toThrow(
			/Invalid Tundra environment configuration/,
		);
	});

	it("parses Redis Sentinel and Redpanda settings", () => {
		const config = loadConfig({
			REDIS_SENTINEL_ADDRS: "redis.redis.svc:26379, redis-2.redis.svc",
			REDIS_SENTINEL_MASTER: "redis-master",
			REDIS_PASSWORD: "sekret",
			REDPANDA_BROKERS: "redpanda.redpanda.svc:9093",
			REDPANDA_SASL_USERNAME: "tundra",
			REDPANDA_SASL_PASSWORD: "haslo",
		});
		expect(config.redis.sentinelAddrs).toEqual([
			{ host: "redis.redis.svc", port: 26379 },
			{ host: "redis-2.redis.svc", port: 26379 },
		]);
		expect(config.redpanda.enabled).toBe(true);
		expect(config.redpanda.brokers).toEqual([{ host: "redpanda.redpanda.svc", port: 9093 }]);
	});

	it("redpanda stays disabled without credentials", () => {
		const config = loadConfig({ REDPANDA_BROKERS: "localhost:9092" });
		expect(config.redpanda.enabled).toBe(false);
	});
});

describe("redisConnectionOptions", () => {
	it("returns sentinel options when sentinel addrs are configured", () => {
		const config = loadConfig({
			REDIS_SENTINEL_ADDRS: "s1:26379,s2:26379",
			REDIS_SENTINEL_MASTER: "redis-master",
			REDIS_PASSWORD: "pw",
		});
		expect(redisConnectionOptions(config.redis)).toEqual({
			sentinels: [
				{ host: "s1", port: 26379 },
				{ host: "s2", port: 26379 },
			],
			name: "redis-master",
			password: "pw",
			sentinelPassword: "pw",
		});
	});

	it("falls back to host/port from REDIS_URL otherwise", () => {
		const config = loadConfig({ REDIS_URL: "redis://cache.local:6380" });
		expect(redisConnectionOptions(config.redis)).toEqual({ host: "cache.local", port: 6380 });
	});
});
