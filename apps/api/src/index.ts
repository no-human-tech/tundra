/**
 * Tundra API entrypoint — GraphQL Yoga served on Hono (architect ADR-0006).
 *
 * `buildApp` is data-source agnostic: it takes a {@link GraphQLContextFactory}
 * (which closes over either the db- or mock-backed DataSource) and a CORS origin,
 * and is side-effect free so tests construct it without a DB or a bound port.
 * `startServer` is where the backend is actually chosen: in `db` mode it opens a
 * Postgres client, migrates, seeds (non-production), and builds the db data
 * source; otherwise it builds the in-memory mock.
 *
 * Auth endpoints
 * --------------
 * Three REST endpoints manage the HTTP-only session cookie:
 *  - `POST /auth/register`     — create account and open a session.
 *  - `POST /auth/login`        — validate credentials and open a session.
 *  - `POST /auth/logout`       — invalidate the current session and clear the cookie.
 *  - `GET /auth/github/start`  — redirect to GitHub authorization page.
 *  - `GET /auth/github/callback` — handle GitHub callback and open a session.
 *  - `GET /auth/oidc/start`    — redirect to the central OIDC provider (PKCE).
 *  - `GET /auth/oidc/callback` — complete the code exchange and open a session.
 *  - `GET /auth/oidc/logout`   — invalidate the session and end the IdP session.
 *
 * The GraphQL context reads the `tundra.session` cookie and falls back to the
 * dev `x-tundra-user-id` header in development/mock mode.
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createYoga } from "graphql-yoga";
import { Redis } from "ioredis";
import { createDbClient, migrateToLatest, seedDev } from "@tundra/db";
import { loadConfig, redisConnectionOptions } from "@tundra/config";
import type { AppConfig } from "@tundra/config";

import type { GitHubConfig } from "@tundra/config";
import {
	exchangeCodeForToken,
	fetchGitHubUser,
	fetchGitHubVerifiedEmail,
	generateState,
	validateState,
} from "./github-oauth.js";
import type { OidcAuth } from "./oidc.js";
import { OIDC_TXN_COOKIE_NAME, createOidcAuth } from "./oidc.js";
import type { NonceStore } from "./nonce-store.js";
import { createRedisNonceStore } from "./nonce-store.js";

import { schema } from "./schema.js";
import type { GraphQLContext, GraphQLContextFactory } from "./context.js";
import { SESSION_COOKIE_NAME, createContextFactory } from "./context.js";
import { createDbDataSource } from "./data-source/db.js";
import { createMockDataSource } from "./data-source/mock.js";
import type { DataSource } from "./data-source/types.js";
import { DEV_USER_HEADER } from "./session.js";

const GRAPHQL_ENDPOINT = "/graphql";

/** Session cookie lifetime in seconds (7 days). */
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

/** Build a Set-Cookie header value for the session token. */
function buildSessionCookie(token: string, maxAge: number, secure: boolean): string {
	const parts = [
		`${SESSION_COOKIE_NAME}=${token}`,
		`Max-Age=${maxAge}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Lax",
	];
	if (secure) {
		parts.push("Secure");
	}
	return parts.join("; ");
}

/** Build a Set-Cookie header that clears the session cookie. */
function clearSessionCookie(secure: boolean): string {
	return buildSessionCookie("", 0, secure);
}

export interface BuildAppOptions {
	/** Produces the per-request GraphQL context (principal + data source). */
	contextFactory: GraphQLContextFactory;
	/**
	 * Allowed CORS origins. Accepts a comma-separated string or an array of
	 * strings. Only listed origins are echoed back in CORS responses so
	 * `credentials: true` (cookie auth) works correctly. Applies to both
	 * `/auth/*` and the GraphQL endpoint.
	 *
	 * The special value `"*"` is permitted **only** when `nodeEnv` is
	 * `"development"` — it reflects the request origin, which browsers accept
	 * for credentialed requests. Passing `"*"` in any other environment throws
	 * at startup to prevent accidental open-CORS in production.
	 */
	corsOrigin: string | string[];
	/** The shared data source (also used by the auth REST endpoints). */
	dataSource: DataSource;
	/** Whether to mark session cookies as `Secure` (production). */
	secureCookie?: boolean;
	/** GitHub OAuth configuration; omit or set `enabled: false` to disable the routes. */
	github?: GitHubConfig;
	/**
	 * OIDC login port (central IdP such as Keycloak); omit to disable the
	 * `/auth/oidc/*` routes. Injected as a port so tests can stub the IdP.
	 */
	oidcAuth?: OidcAuth;
	/**
	 * Whether the built-in email/password endpoints (`/auth/register`,
	 * `/auth/login`) are offered. Defaults to true (the self-hosted profile);
	 * OIDC-only production deployments set this to false and the endpoints
	 * answer 503 `provider_not_configured`.
	 */
	localAuthEnabled?: boolean;
	/** Frontend origin used for post-OAuth redirects (e.g. `http://localhost:5173`). */
	frontendUrl?: string;
	/**
	 * Runtime environment name. Controls whether `corsOrigin: "*"` is
	 * permitted. Defaults to `"development"`.
	 */
	nodeEnv?: string;
	/**
	 * Readiness probe: resolves when the app's dependencies (DB, Redis) can
	 * serve traffic, rejects otherwise. When omitted, `/ready` always reports
	 * ok (mock mode / tests with no external dependencies).
	 */
	readinessCheck?: () => Promise<void>;
	/**
	 * Single-use nonce consumption for OAuth state tokens. Defaults to the
	 * per-process in-memory store; production injects the Redis-backed store
	 * so single-use holds across replicas.
	 */
	nonceStore?: NonceStore;
}

/**
 * Convert the raw corsOrigin config into a Hono-compatible origin function.
 *
 * `"*"` is only valid in `nodeEnv === "development"` — it reflects the
 * request origin so browsers accept it for credentialed requests. In all
 * other environments `"*"` throws immediately so the misconfiguration is
 * caught at startup rather than silently opening CORS to every origin.
 * Comma-separated strings are split and trimmed before matching.
 */
function buildOriginHandler(
	corsOrigin: string | string[],
	nodeEnv: string,
): (origin: string) => string | undefined {
	const allowed = Array.isArray(corsOrigin)
		? corsOrigin
		: corsOrigin
				.split(",")
				.map((o) => o.trim())
				.filter(Boolean);

	if (allowed.length === 1 && allowed[0] === "*") {
		if (nodeEnv !== "development") {
			throw new Error(
				`CORS_ORIGIN="*" is not allowed outside NODE_ENV=development (got NODE_ENV=${nodeEnv}). ` +
					"Set explicit allowed origins, e.g. CORS_ORIGIN=http://localhost:5173,http://localhost:5174",
			);
		}
		// Dev wildcard: reflect the request origin so credentials:true works.
		return (origin) => origin;
	}

	const allowSet = new Set(allowed);
	return (origin) => (allowSet.has(origin) ? origin : undefined);
}

/**
 * Build the Hono app: a liveness probe at `GET /health`, auth REST endpoints,
 * CORS on the GraphQL route, and the Yoga handler with the injected per-request
 * context.
 */
export function buildApp(options: BuildAppOptions): Hono {
	const app = new Hono();
	const isSecure = options.secureCookie ?? false;
	const nodeEnv = options.nodeEnv ?? "development";

	// Shared CORS options — applied to both /auth/* and /graphql so credentials
	// (cookies) and the dev user header work uniformly across REST and GraphQL.
	const corsOptions = {
		origin: buildOriginHandler(options.corsOrigin, nodeEnv),
		allowHeaders: ["Content-Type", DEV_USER_HEADER],
		allowMethods: ["GET", "POST", "OPTIONS"],
		credentials: true,
	};

	// Liveness: the process is up. Readiness: dependencies can serve traffic —
	// a pod must not receive traffic before its DB/Redis connections work.
	app.get("/health", (c) => c.json({ status: "ok" }));
	app.get("/ready", async (c) => {
		if (!options.readinessCheck) {
			return c.json({ status: "ok" });
		}
		try {
			await options.readinessCheck();
			return c.json({ status: "ok" });
		} catch (err) {
			const reason = err instanceof Error ? err.message : "dependency check failed";
			return c.json({ status: "unavailable", reason }, 503);
		}
	});

	// CORS preflight for all auth endpoints must be handled before the route
	// handlers; the middleware is registered here, ahead of the route definitions.
	app.use("/auth/*", cors(corsOptions));

	// --- Auth REST endpoints -----------------------------------------------------

	const localAuthEnabled = options.localAuthEnabled ?? true;

	app.post("/auth/register", async (c) => {
		if (!localAuthEnabled) {
			return c.json({ error: "provider_not_configured" }, 503);
		}
		let body: { email?: string; password?: string; displayName?: string };
		try {
			body = await c.req.json<typeof body>();
		} catch {
			return c.json({ error: "invalid_json" }, 400);
		}

		const { email, password, displayName } = body;
		if (!email || !password || !displayName) {
			return c.json({ error: "missing_fields" }, 400);
		}
		if (password.length < 8) {
			return c.json({ error: "password_too_short" }, 400);
		}

		const result = await options.dataSource.register(email, password, displayName);
		if ("error" in result) {
			return c.json({ error: result.error }, 409);
		}

		const headers = new Headers({ "Content-Type": "application/json" });
		headers.set("Set-Cookie", buildSessionCookie(result.sessionToken, SESSION_MAX_AGE, isSecure));
		return new Response(JSON.stringify({ userId: result.userId }), { status: 201, headers });
	});

	app.post("/auth/login", async (c) => {
		if (!localAuthEnabled) {
			return c.json({ error: "provider_not_configured" }, 503);
		}
		let body: { email?: string; password?: string };
		try {
			body = await c.req.json<typeof body>();
		} catch {
			return c.json({ error: "invalid_json" }, 400);
		}

		const { email, password } = body;
		if (!email || !password) {
			return c.json({ error: "missing_fields" }, 400);
		}

		const result = await options.dataSource.login(email, password);
		if ("error" in result) {
			// Return 401 for auth failures; do not reveal which field is wrong.
			return c.json({ error: "invalid_credentials" }, 401);
		}

		const headers = new Headers({ "Content-Type": "application/json" });
		headers.set("Set-Cookie", buildSessionCookie(result.sessionToken, SESSION_MAX_AGE, isSecure));
		return new Response(JSON.stringify({ userId: result.userId }), { status: 200, headers });
	});

	app.post("/auth/logout", async (c) => {
		const cookieHeader = c.req.header("cookie") ?? null;
		const rawToken = parseCookieValue(cookieHeader, SESSION_COOKIE_NAME);
		if (rawToken) {
			await options.dataSource.invalidateSession(rawToken);
		}

		const headers = new Headers({ "Content-Type": "application/json" });
		headers.set("Set-Cookie", clearSessionCookie(isSecure));
		return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
	});

	// --- GitHub OAuth endpoints ------------------------------------------------

	const github = options.github ?? {
		enabled: false,
		clientId: "",
		clientSecret: "",
		callbackUrl: "",
	};
	const frontendUrl = options.frontendUrl ?? "http://localhost:5173";

	app.get("/auth/github/start", (c) => {
		if (!github.enabled) {
			return c.json({ error: "provider_not_configured" }, 503);
		}
		const state = generateState(github.clientSecret);
		const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
		authorizeUrl.searchParams.set("client_id", github.clientId);
		authorizeUrl.searchParams.set("redirect_uri", github.callbackUrl);
		authorizeUrl.searchParams.set("scope", "read:user user:email");
		authorizeUrl.searchParams.set("state", state);
		return c.redirect(authorizeUrl.toString(), 302);
	});

	app.get("/auth/github/callback", async (c) => {
		const loginUrl = `${frontendUrl}/login`;

		if (!github.enabled) {
			return c.redirect(`${loginUrl}?error=provider_not_configured`, 302);
		}

		const code = c.req.query("code");
		const state = c.req.query("state");

		if (!code || !state) {
			return c.redirect(`${loginUrl}?error=oauth_state_invalid`, 302);
		}

		const stateError = await validateState(state, github.clientSecret, options.nonceStore);
		if (stateError) {
			return c.redirect(`${loginUrl}?error=oauth_state_invalid`, 302);
		}

		const token = await exchangeCodeForToken(
			code,
			github.clientId,
			github.clientSecret,
			github.callbackUrl,
		);
		if (!token) {
			return c.redirect(`${loginUrl}?error=oauth_exchange_failed`, 302);
		}

		const [ghUser, ghEmail] = await Promise.all([
			fetchGitHubUser(token),
			fetchGitHubVerifiedEmail(token),
		]);

		if (!ghUser) {
			return c.redirect(`${loginUrl}?error=oauth_profile_unavailable`, 302);
		}

		const result = await options.dataSource.loginWithGitHub({
			githubUserId: String(ghUser.id),
			githubLogin: ghUser.login,
			githubName: ghUser.name,
			verifiedEmail: ghEmail, // Only the verified email from /user/emails
		});

		if ("error" in result) {
			return c.redirect(`${loginUrl}?error=${encodeURIComponent(result.error)}`, 302);
		}

		const responseHeaders = new Headers();
		responseHeaders.set(
			"Set-Cookie",
			buildSessionCookie(result.sessionToken, SESSION_MAX_AGE, isSecure),
		);
		responseHeaders.set("Location", `${frontendUrl}/dashboard`);
		return new Response(null, { status: 302, headers: responseHeaders });
	});

	// --- OIDC endpoints (central IdP, e.g. Keycloak) ---------------------------

	const oidcAuth = options.oidcAuth;

	/** Set-Cookie for the short-lived OIDC transaction (scoped to the callback path). */
	const buildTxnCookie = (value: string, maxAge: number): string => {
		const parts = [
			`${OIDC_TXN_COOKIE_NAME}=${value}`,
			`Max-Age=${maxAge}`,
			"Path=/auth/oidc",
			"HttpOnly",
			"SameSite=Lax",
		];
		if (isSecure) {
			parts.push("Secure");
		}
		return parts.join("; ");
	};

	app.get("/auth/oidc/start", async (c) => {
		if (!oidcAuth) {
			return c.json({ error: "provider_not_configured" }, 503);
		}
		let start: { authorizationUrl: string; txnCookieValue: string };
		try {
			start = await oidcAuth.start();
		} catch {
			// Discovery/IdP unreachable — send the user back with a generic error.
			return c.redirect(`${frontendUrl}/login?error=sso_failed`, 302);
		}
		const headers = new Headers();
		headers.set("Set-Cookie", buildTxnCookie(start.txnCookieValue, 600));
		headers.set("Location", start.authorizationUrl);
		return new Response(null, { status: 302, headers });
	});

	app.get("/auth/oidc/callback", async (c) => {
		const loginUrl = `${frontendUrl}/login`;
		if (!oidcAuth) {
			return c.redirect(`${loginUrl}?error=provider_not_configured`, 302);
		}

		const txnCookieValue = parseCookieValue(c.req.header("cookie") ?? null, OIDC_TXN_COOKIE_NAME);
		const profile = await oidcAuth.callback(new URL(c.req.url), txnCookieValue);

		// The transaction cookie is single-use: clear it on every outcome.
		const headers = new Headers();
		headers.append("Set-Cookie", buildTxnCookie("", 0));

		if ("error" in profile) {
			headers.set("Location", `${loginUrl}?error=sso_failed`);
			return new Response(null, { status: 302, headers });
		}

		const result = await options.dataSource.loginWithOidc({
			subject: profile.subject,
			verifiedEmail: profile.verifiedEmail,
			name: profile.name,
			workspaceRole: profile.workspaceRole,
		});

		if ("error" in result) {
			headers.set("Location", `${loginUrl}?error=${encodeURIComponent(result.error)}`);
			return new Response(null, { status: 302, headers });
		}

		headers.append(
			"Set-Cookie",
			buildSessionCookie(result.sessionToken, SESSION_MAX_AGE, isSecure),
		);
		headers.set("Location", `${frontendUrl}/dashboard`);
		return new Response(null, { status: 302, headers });
	});

	app.get("/auth/oidc/logout", async (c) => {
		const rawToken = parseCookieValue(c.req.header("cookie") ?? null, SESSION_COOKIE_NAME);
		if (rawToken) {
			await options.dataSource.invalidateSession(rawToken);
		}

		// RP-initiated logout: end the IdP session too, then land back on /login.
		const postLogout = `${frontendUrl}/login`;
		const endSession = oidcAuth ? await oidcAuth.endSessionUrl(postLogout) : null;

		const headers = new Headers();
		headers.set("Set-Cookie", clearSessionCookie(isSecure));
		headers.set("Location", endSession ?? postLogout);
		return new Response(null, { status: 302, headers });
	});

	// --- GraphQL endpoint --------------------------------------------------------

	app.use(GRAPHQL_ENDPOINT, cors(corsOptions));

	const yoga = createYoga<{ request: Request }, GraphQLContext>({
		schema,
		graphqlEndpoint: GRAPHQL_ENDPOINT,
		context: ({ request }) => options.contextFactory(request),
	});

	// Yoga speaks the Web `Request`/`Response` standard, which Hono passes through.
	app.all(GRAPHQL_ENDPOINT, (c) => yoga.fetch(c.req.raw));

	return app;
}

/**
 * Start the HTTP server. Selects the data source from `config.dataSource`: `db`
 * opens Postgres (+ optionally migrates and, outside production, seeds), `mock`
 * uses in-memory fixtures. Logs which mode is active.
 *
 * In db mode a Redis connection backs the cross-replica nonce store and the
 * readiness probe. SIGTERM/SIGINT drain the HTTP server and close the pool and
 * Redis before exit (rolling updates on k8s).
 */
export async function startServer(config: AppConfig = loadConfig()): Promise<void> {
	let dataSource: DataSource;
	let readinessCheck: (() => Promise<void>) | undefined;
	let nonceStore: NonceStore | undefined;
	const closers: Array<() => Promise<unknown>> = [];

	if (config.dataSource === "db") {
		const handle = createDbClient(config.postgres.databaseUrl);
		closers.push(() => handle.close());

		if (config.postgres.runMigrationsOnStart) {
			// Serialized behind a pg advisory lock; production runs migrations as
			// a dedicated Job instead (RUN_MIGRATIONS_ON_START defaults to false).
			await migrateToLatest(handle);
		}
		if (config.nodeEnv !== "production") {
			await seedDev(handle);
		}
		dataSource = createDbDataSource(handle);

		// Plain host/port in dev; Sentinel options (client-side failover) when
		// REDIS_SENTINEL_ADDRS is configured.
		const redis = new Redis({
			...redisConnectionOptions(config.redis),
			// Do not crash on a Redis blip; commands queue and retry while the
			// readiness probe reports unavailable.
			maxRetriesPerRequest: 1,
			lazyConnect: true,
		});
		redis.on("error", (err) => console.error("[api] redis error:", err.message));
		await redis.connect().catch((err) => {
			// Redis being down must not prevent startup — readiness gates traffic.
			console.error("[api] redis connect failed (will retry):", (err as Error).message);
		});
		closers.push(() => redis.quit().catch(() => redis.disconnect()));

		nonceStore = createRedisNonceStore(redis);
		readinessCheck = async () => {
			await handle.pool.query("SELECT 1");
			const pong = await redis.ping();
			if (pong !== "PONG") {
				throw new Error("redis ping failed");
			}
		};
		console.log("Tundra API data source: db (Postgres)");
	} else {
		dataSource = createMockDataSource();
		console.log("Tundra API data source: mock (in-memory)");
	}

	// The dev identity header is strictly a development/mock convenience — in
	// production a request without a valid session cookie stays anonymous.
	const allowDevFallback = config.nodeEnv === "development" || config.dataSource === "mock";
	const contextFactory = createContextFactory(dataSource, { allowDevFallback });
	const isSecure = config.nodeEnv === "production";
	const app = buildApp({
		contextFactory,
		corsOrigin: config.api.corsOrigin,
		dataSource,
		secureCookie: isSecure,
		github: config.github,
		oidcAuth: config.oidc.enabled ? createOidcAuth(config.oidc) : undefined,
		localAuthEnabled: config.auth.localEnabled,
		frontendUrl: config.frontendUrl,
		nodeEnv: config.nodeEnv,
		readinessCheck,
		nonceStore,
	});

	const server = serve({ fetch: app.fetch, hostname: config.api.host, port: config.api.port });
	console.log(
		`Tundra API listening on http://${config.api.host}:${config.api.port}${GRAPHQL_ENDPOINT}`,
	);

	// Graceful shutdown: stop accepting connections, then close dependencies.
	let shuttingDown = false;
	const shutdown = (signal: string): void => {
		if (shuttingDown) return;
		shuttingDown = true;
		console.log(`Tundra API received ${signal}, shutting down...`);
		server.close(() => {
			void Promise.allSettled(closers.map((close) => close())).then(() => {
				process.exit(0);
			});
		});
		// Belt and braces: force-exit if draining hangs past the k8s grace period.
		setTimeout(() => process.exit(1), 25_000).unref();
	};
	process.once("SIGTERM", () => shutdown("SIGTERM"));
	process.once("SIGINT", () => shutdown("SIGINT"));
}

/** Parse the value of a named cookie from a `Cookie` header string. */
function parseCookieValue(cookieHeader: string | null, name: string): string | null {
	if (!cookieHeader) {
		return null;
	}
	for (const part of cookieHeader.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key?.trim() === name) {
			return rest.join("=").trim() || null;
		}
	}
	return null;
}

// Entry guard: only bind a port when run directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
	void startServer();
}
