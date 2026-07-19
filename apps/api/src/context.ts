/**
 * The GraphQL execution context.
 *
 * Every resolver receives `{ principal, dataSource }` so it can answer against
 * the request's authorization context and the configured backend without knowing
 * which backend that is. The context is produced per request by a
 * {@link GraphQLContextFactory}: in the server it reads the session cookie (or
 * falls back to the dev header in development) and resolves the principal via
 * the data source; in tests it is supplied directly.
 *
 * Auth strategy
 * -------------
 * Real auth uses an HTTP-only session cookie (`tundra.session`). The context
 * factory:
 *  1. Reads the cookie from the request.
 *  2. Calls `dataSource.resolveSession` to validate it.
 *  3. On success, calls `dataSource.loadPrincipal` to build the principal.
 *  4. In development (or when no cookie is present), falls back to the
 *     `x-tundra-user-id` dev header to keep existing tests working.
 */

import type { SessionPrincipal } from "@tundra/domain";

import type { DataSource } from "./data-source/types.js";
import { buildAnonymousPrincipal, buildMockPrincipal, devUserIdFromHeaders } from "./session.js";

/** Name of the HTTP-only session cookie. */
export const SESSION_COOKIE_NAME = "tundra.session";

/**
 * How `principal` was resolved for this request:
 *  - `"cookie"` — a real, validated `tundra.session` cookie.
 *  - `"dev-fallback"` — no valid cookie; resolved from the `x-tundra-user-id`
 *    dev header (or its default) purely for local-dev/demo convenience.
 *  - `"anonymous"` — no valid cookie and the dev fallback is disabled
 *    (production): an empty principal with no user and no permissions.
 *
 * Every resolver may use `principal` regardless of source (so dev tooling and
 * demo data keep working without a real login) — but the `viewer` resolver
 * specifically treats anything that is not `"cookie"` as "no session", so
 * `/login` is not skipped just because the dev fallback can resolve *someone*.
 */
export type SessionSource = "cookie" | "dev-fallback" | "anonymous";

/** What every resolver sees as its third argument. */
export interface GraphQLContext {
	principal: SessionPrincipal;
	dataSource: DataSource;
	sessionSource: SessionSource;
}

/** Builds a per-request context from the incoming request. */
export type GraphQLContextFactory = (request: Request) => Promise<GraphQLContext>;

/**
 * Parse the value of a named cookie from a `Cookie` header string.
 *
 * Returns `null` when the header is absent or the name is not found.
 */
function parseCookie(cookieHeader: string | null, name: string): string | null {
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

export interface ContextFactoryOptions {
	/**
	 * Whether a request without a valid session cookie may resolve the acting
	 * user from the `x-tundra-user-id` dev header. Defaults to true (local dev,
	 * mock mode, tests). Production disables it, so cookie-less requests get an
	 * anonymous principal with no permissions instead of an impersonated user.
	 */
	allowDevFallback?: boolean;
}

/**
 * Create the context factory used by the server. Resolves the acting user from
 * the session cookie when present; falls back to the dev `x-tundra-user-id`
 * header (when allowed) so existing mock-mode tests and development tooling
 * keep working.
 */
export function createContextFactory(
	dataSource: DataSource,
	options: ContextFactoryOptions = {},
): GraphQLContextFactory {
	const allowDevFallback = options.allowDevFallback ?? true;

	return async (request: Request): Promise<GraphQLContext> => {
		const cookieHeader = request.headers.get("cookie");
		const rawToken = parseCookie(cookieHeader, SESSION_COOKIE_NAME);

		if (rawToken) {
			const userId = await dataSource.resolveSession(rawToken);
			if (userId) {
				const principal = (await dataSource.loadPrincipal(userId)) ?? buildMockPrincipal(userId);
				return { principal, dataSource, sessionSource: "cookie" };
			}
		}

		if (!allowDevFallback) {
			// Production: no valid cookie means no identity — the dev header must
			// never select a user outside development.
			return { principal: buildAnonymousPrincipal(), dataSource, sessionSource: "anonymous" };
		}

		// Fallback: dev header (mock mode / dev without a real session cookie).
		const userId = devUserIdFromHeaders(request.headers);
		const principal = (await dataSource.loadPrincipal(userId)) ?? buildMockPrincipal(userId);
		return { principal, dataSource, sessionSource: "dev-fallback" };
	};
}
