/**
 * @tundra/config — environment loading and validation.
 *
 * Pure, no domain knowledge. Parses `process.env` into a typed, frozen config
 * object via zod. Defaults mirror the repo `.env.example`. Apps and `db` depend
 * on this; nothing here depends on other @tundra packages.
 *
 * See architect report 01 §1.
 */

import { z } from "zod";

/** A loose record of environment variables (string | undefined values). */
export type EnvRecord = Record<string, string | undefined>;

/** Coerce a string env var into an integer with a default and validation. */
const intFromEnv = (def: number) =>
	z
		.string()
		.optional()
		.transform((v) => (v === undefined || v === "" ? def : v))
		.pipe(z.coerce.number().int());

const stringWithDefault = (def: string) =>
	z
		.string()
		.optional()
		.transform((v) => (v === undefined || v === "" ? def : v));

/**
 * A "true"/"false" (case-insensitive) env flag. Unset or empty yields `""` so
 * callers can resolve their own default — some flags default to a fixed
 * value, others depend on `NODE_ENV`. Any value that is not empty and not
 * "true"/"false" fails validation instead of silently falling back: a typo'd
 * override (e.g. `"False"` with a stray space, or `"0"`) must not silently
 * leave the flag at its default when the deployer meant to change it.
 */
const optionalBooleanFlag = () =>
	z
		.string()
		.optional()
		.transform((v) => (v === undefined ? "" : v))
		.pipe(
			z.union([
				z.literal(""),
				z
					.string()
					.toLowerCase()
					.pipe(z.enum(["true", "false"])),
			]),
		);

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace"] as const;

const dataSources = ["mock", "db"] as const;

/**
 * The raw env schema. Keys match the variable names in `.env.example`. This is
 * exported so tests and tooling can reason about the accepted shape.
 */
export const envSchema = z.object({
	NODE_ENV: stringWithDefault("development"),

	API_HOST: stringWithDefault("0.0.0.0"),
	API_PORT: intFromEnv(4000).pipe(z.number().int().min(1).max(65535)),
	GRAPHQL_PATH: stringWithDefault("/graphql"),
	CORS_ORIGIN: stringWithDefault("http://localhost:5173,http://localhost:5174"),

	/** Which backend the API reads from: in-memory mock data or Postgres. */
	TUNDRA_DATA_SOURCE: z
		.string()
		.optional()
		.transform((v) => (v === undefined || v === "" ? "mock" : v))
		.pipe(z.enum(dataSources)),

	VITE_API_URL: stringWithDefault("http://localhost:4000/graphql"),

	WORKER_CONCURRENCY: intFromEnv(5).pipe(z.number().int().min(1)),

	POSTGRES_HOST: stringWithDefault("localhost"),
	POSTGRES_PORT: intFromEnv(5432).pipe(z.number().int().min(1).max(65535)),
	POSTGRES_USER: stringWithDefault("tundra"),
	POSTGRES_PASSWORD: stringWithDefault("tundra"),
	POSTGRES_DB: stringWithDefault("tundra"),
	DATABASE_URL: stringWithDefault("postgres://tundra:tundra@localhost:5432/tundra"),

	REDIS_HOST: stringWithDefault("localhost"),
	REDIS_PORT: intFromEnv(6379).pipe(z.number().int().min(1).max(65535)),
	REDIS_URL: stringWithDefault("redis://localhost:6379"),
	/**
	 * Redis Sentinel endpoints as a comma-separated `host:port` list. When set,
	 * clients connect through Sentinel (with `REDIS_SENTINEL_MASTER`) instead
	 * of `REDIS_URL`, so failover is handled client-side.
	 */
	REDIS_SENTINEL_ADDRS: stringWithDefault(""),
	REDIS_SENTINEL_MASTER: stringWithDefault("redis-master"),
	REDIS_PASSWORD: stringWithDefault(""),

	/** Kafka-compatible brokers (Redpanda) as a comma-separated `host:port` list. */
	REDPANDA_BROKERS: stringWithDefault(""),
	REDPANDA_SASL_MECHANISM: stringWithDefault("SCRAM-SHA-512"),
	REDPANDA_SASL_USERNAME: stringWithDefault(""),
	REDPANDA_SASL_PASSWORD: stringWithDefault(""),

	LOG_LEVEL: z
		.string()
		.optional()
		.transform((v) => (v === undefined || v === "" ? "info" : v))
		.pipe(z.enum(logLevels)),

	GITHUB_CLIENT_ID: stringWithDefault(""),
	GITHUB_CLIENT_SECRET: stringWithDefault(""),
	GITHUB_CALLBACK_URL: stringWithDefault(""),
	FRONTEND_URL: stringWithDefault("http://localhost:5173"),

	OIDC_ISSUER_URL: stringWithDefault(""),
	OIDC_CLIENT_ID: stringWithDefault(""),
	OIDC_CLIENT_SECRET: stringWithDefault(""),
	OIDC_REDIRECT_URL: stringWithDefault(""),

	/**
	 * Whether the built-in email/password provider (register + login) is
	 * offered. Production deployments that log in exclusively through the
	 * central OIDC provider set this to "false"; the endpoints then return
	 * provider_not_configured. Unset defaults to enabled (the self-hosted
	 * profile); any non-empty value that isn't "true"/"false" is a config
	 * error rather than a silent fallback to enabled.
	 */
	AUTH_LOCAL_ENABLED: optionalBooleanFlag(),

	/**
	 * Whether the API applies pending DB migrations on startup. Unset defaults
	 * to the environment's convention: on outside production (single-process
	 * dev convenience), off in production, where a dedicated migration Job
	 * runs before each rollout. Explicit "true"/"false" (case-insensitive)
	 * always wins; anything else is a config error.
	 */
	RUN_MIGRATIONS_ON_START: optionalBooleanFlag(),
});

export type ParsedEnv = z.infer<typeof envSchema>;

export interface ApiConfig {
	host: string;
	port: number;
	graphqlPath: string;
	/**
	 * Allowed CORS origins. Parsed from the comma-separated `CORS_ORIGIN` env var.
	 * A single-element array containing `"*"` permits any origin (dev only —
	 * browsers block credentialed requests to wildcard origins; use a reflective
	 * origin handler at the HTTP layer instead of sending `*`).
	 */
	corsOrigin: string[];
}

export interface WebConfig {
	apiUrl: string;
}

export interface WorkerConfig {
	concurrency: number;
}

export interface PostgresConfig {
	databaseUrl: string;
	host: string;
	port: number;
	user: string;
	password: string;
	database: string;
	/**
	 * Whether the API runs `migrateToLatest` on startup. Defaults to true
	 * outside production and false in production (migrations run as a
	 * dedicated Job there); `RUN_MIGRATIONS_ON_START` overrides explicitly.
	 */
	runMigrationsOnStart: boolean;
}

/** One `host:port` network address. */
export interface NetAddress {
	host: string;
	port: number;
}

export interface RedisConfig {
	redisUrl: string;
	host: string;
	port: number;
	/** Sentinel endpoints; non-empty switches clients into Sentinel mode. */
	sentinelAddrs: NetAddress[];
	/** Sentinel master-set name (only meaningful with `sentinelAddrs`). */
	sentinelMaster: string;
	/** AUTH password for Redis (and its sentinels); empty when auth is off. */
	password: string;
}

/**
 * ioredis/BullMQ-compatible connection options derived from a
 * {@link RedisConfig}: Sentinel options when sentinel endpoints are
 * configured, plain host/port otherwise. Pure data — no client import.
 */
export function redisConnectionOptions(
	redis: RedisConfig,
):
	| { sentinels: NetAddress[]; name: string; password?: string; sentinelPassword?: string }
	| { host: string; port: number; password?: string } {
	if (redis.sentinelAddrs.length > 0) {
		return {
			sentinels: redis.sentinelAddrs,
			name: redis.sentinelMaster,
			...(redis.password !== ""
				? { password: redis.password, sentinelPassword: redis.password }
				: {}),
		};
	}
	const url = new URL(redis.redisUrl);
	return {
		host: url.hostname,
		port: url.port ? Number(url.port) : 6379,
		...(redis.password !== "" ? { password: redis.password } : {}),
	};
}

/**
 * Kafka-compatible integration bus (Redpanda). Enabled only when brokers and
 * SASL credentials are all present.
 */
export interface RedpandaConfig {
	brokers: NetAddress[];
	saslMechanism: string;
	saslUsername: string;
	saslPassword: string;
	/** True when brokers and SASL credentials are configured. */
	enabled: boolean;
}

export interface LoggingConfig {
	level: (typeof logLevels)[number];
}

export interface GitHubConfig {
	clientId: string;
	clientSecret: string;
	callbackUrl: string;
	/** True when all three GitHub OAuth credentials are present. */
	enabled: boolean;
}

/**
 * OpenID Connect client configuration (Authorization Code + PKCE against a
 * central IdP such as Keycloak). Enabled only when all four values are set.
 */
export interface OidcConfig {
	/** Issuer URL used for OIDC discovery, e.g. `https://id.example.com/realms/acme`. */
	issuerUrl: string;
	clientId: string;
	clientSecret: string;
	/** Absolute redirect URL registered at the IdP, e.g. `https://app.example.com/auth/oidc/callback`. */
	redirectUrl: string;
	/** True when issuer, client id, client secret, and redirect URL are all present. */
	enabled: boolean;
}

/** Feature switches for the built-in auth providers. */
export interface AuthConfig {
	/** Whether email/password register + login endpoints are offered. */
	localEnabled: boolean;
}

export interface AppConfig {
	nodeEnv: string;
	/** Selects the API's data backend: "mock" (in-memory) or "db" (Postgres). */
	dataSource: (typeof dataSources)[number];
	api: ApiConfig;
	web: WebConfig;
	worker: WorkerConfig;
	postgres: PostgresConfig;
	redis: RedisConfig;
	redpanda: RedpandaConfig;
	logging: LoggingConfig;
	github: GitHubConfig;
	oidc: OidcConfig;
	auth: AuthConfig;
	frontendUrl: string;
}

/** Parse a comma-separated `host:port` list into addresses (default port when omitted). */
function parseAddressList(raw: string, defaultPort: number): NetAddress[] {
	return raw
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean)
		.map((entry) => {
			const colonIdx = entry.lastIndexOf(":");
			if (colonIdx < 0) {
				return { host: entry, port: defaultPort };
			}
			const port = Number(entry.slice(colonIdx + 1));
			return {
				host: entry.slice(0, colonIdx),
				port: Number.isInteger(port) && port > 0 ? port : defaultPort,
			};
		});
}

/** Recursively freeze a config object so callers cannot mutate shared state. */
function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === "object") {
		for (const key of Object.keys(value)) {
			deepFreeze((value as Record<string, unknown>)[key]);
		}
		Object.freeze(value);
	}
	return value;
}

/**
 * Parse and validate environment variables into a typed, frozen `AppConfig`.
 *
 * Accepts an explicit `env` record for testability; defaults to `process.env`.
 * Throws a single aggregated `Error` listing every invalid variable.
 */
export function loadConfig(env: EnvRecord = process.env): AppConfig {
	const result = envSchema.safeParse(env);
	if (!result.success) {
		const issues = result.error.issues
			.map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
			.join("\n");
		throw new Error(`Invalid Tundra environment configuration:\n${issues}`);
	}

	const e = result.data;
	const config: AppConfig = {
		nodeEnv: e.NODE_ENV,
		dataSource: e.TUNDRA_DATA_SOURCE,
		api: {
			host: e.API_HOST,
			port: e.API_PORT,
			graphqlPath: e.GRAPHQL_PATH,
			corsOrigin: e.CORS_ORIGIN.split(",")
				.map((o) => o.trim())
				.filter(Boolean),
		},
		web: {
			apiUrl: e.VITE_API_URL,
		},
		worker: {
			concurrency: e.WORKER_CONCURRENCY,
		},
		postgres: {
			databaseUrl: e.DATABASE_URL,
			host: e.POSTGRES_HOST,
			port: e.POSTGRES_PORT,
			user: e.POSTGRES_USER,
			password: e.POSTGRES_PASSWORD,
			database: e.POSTGRES_DB,
			runMigrationsOnStart:
				e.RUN_MIGRATIONS_ON_START === ""
					? e.NODE_ENV !== "production"
					: e.RUN_MIGRATIONS_ON_START === "true",
		},
		redis: {
			redisUrl: e.REDIS_URL,
			host: e.REDIS_HOST,
			port: e.REDIS_PORT,
			sentinelAddrs: parseAddressList(e.REDIS_SENTINEL_ADDRS, 26379),
			sentinelMaster: e.REDIS_SENTINEL_MASTER,
			password: e.REDIS_PASSWORD,
		},
		redpanda: {
			brokers: parseAddressList(e.REDPANDA_BROKERS, 9092),
			saslMechanism: e.REDPANDA_SASL_MECHANISM,
			saslUsername: e.REDPANDA_SASL_USERNAME,
			saslPassword: e.REDPANDA_SASL_PASSWORD,
			enabled:
				e.REDPANDA_BROKERS !== "" &&
				e.REDPANDA_SASL_USERNAME !== "" &&
				e.REDPANDA_SASL_PASSWORD !== "",
		},
		logging: {
			level: e.LOG_LEVEL,
		},
		github: {
			clientId: e.GITHUB_CLIENT_ID,
			clientSecret: e.GITHUB_CLIENT_SECRET,
			callbackUrl: e.GITHUB_CALLBACK_URL,
			enabled:
				e.GITHUB_CLIENT_ID !== "" && e.GITHUB_CLIENT_SECRET !== "" && e.GITHUB_CALLBACK_URL !== "",
		},
		oidc: {
			issuerUrl: e.OIDC_ISSUER_URL,
			clientId: e.OIDC_CLIENT_ID,
			clientSecret: e.OIDC_CLIENT_SECRET,
			redirectUrl: e.OIDC_REDIRECT_URL,
			enabled:
				e.OIDC_ISSUER_URL !== "" &&
				e.OIDC_CLIENT_ID !== "" &&
				e.OIDC_CLIENT_SECRET !== "" &&
				e.OIDC_REDIRECT_URL !== "",
		},
		auth: {
			localEnabled: e.AUTH_LOCAL_ENABLED === "" ? true : e.AUTH_LOCAL_ENABLED === "true",
		},
		frontendUrl: e.FRONTEND_URL,
	};

	return deepFreeze(config);
}
