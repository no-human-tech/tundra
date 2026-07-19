/**
 * Minimal GraphQL-over-HTTP client for the Tundra web app.
 *
 * Deliberately dependency-free: a single `fetch` POST to the API's `/graphql`
 * endpoint. No client cache, no codegen, no Apollo — the app's data needs are a
 * handful of read queries this phase, so a thin function keeps the bundle small
 * and the behaviour obvious.
 *
 * Auth is NOT implemented yet (see docs/agent-reports/persistence/02-api.md §2):
 * the acting user is carried by the dev header `x-tundra-user-id`, defaulting to
 * `user-ada`. When real auth lands this header is replaced by a session token;
 * nothing else in this client changes.
 *
 * Resilience: every request is aborted after a short timeout so that when the
 * API is unreachable (the default `vite preview` e2e run, or a dev machine with
 * no API up) the caller fails FAST and can fall back to clearly-marked demo
 * data instead of hanging on a long TCP timeout.
 */

/** The dev session header (no real auth yet). Mirrors the API's constant. */
export const DEV_USER_HEADER = "x-tundra-user-id";

/** Default acting user when no override is supplied. */
export const DEFAULT_DEV_USER_ID = "user-ada";

/** How long (ms) to wait before aborting a request and falling back to demo. */
const REQUEST_TIMEOUT_MS = 4000;

/**
 * The GraphQL endpoint. `VITE_API_URL` is read at build time by Vite; when unset
 * (local dev, the default e2e preview) it falls back to the local API.
 */
export function apiUrl(): string {
	return import.meta.env.VITE_API_URL ?? "http://localhost:4000/graphql";
}

/** The acting dev user id (overridable via `VITE_DEV_USER_ID`). */
function devUserId(): string {
	return import.meta.env.VITE_DEV_USER_ID ?? DEFAULT_DEV_USER_ID;
}

/** Shape of a GraphQL error entry as returned in the `errors` array. */
interface GraphQLErrorEntry {
	message: string;
}

interface GraphQLResponse<T> {
	data?: T;
	errors?: GraphQLErrorEntry[];
}

/**
 * Thrown for any GraphQL request failure: a network/abort error, a non-2xx
 * response, or a GraphQL `errors` array. Callers catch this to fall back to demo
 * data; the `cause` preserves the underlying error for diagnostics.
 */
export class GraphQLRequestError extends Error {
	constructor(message: string, options?: { cause?: unknown }) {
		super(message, options);
		this.name = "GraphQLRequestError";
	}
}

/**
 * Execute a single GraphQL operation and return its typed `data`.
 *
 * Throws {@link GraphQLRequestError} on a network/timeout error, a non-OK HTTP
 * status, a GraphQL `errors` array, or a missing `data` field — so the caller
 * has exactly one failure channel to fall back from.
 */
export async function graphqlRequest<T>(
	query: string,
	variables?: Record<string, unknown>,
): Promise<T> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(apiUrl(), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				[DEV_USER_HEADER]: devUserId(),
			},
			credentials: "include",
			body: JSON.stringify({ query, variables }),
			signal: controller.signal,
		});
	} catch (cause) {
		throw new GraphQLRequestError(
			cause instanceof Error && cause.name === "AbortError"
				? `GraphQL request timed out after ${REQUEST_TIMEOUT_MS}ms`
				: "GraphQL network request failed",
			{ cause },
		);
	} finally {
		clearTimeout(timer);
	}

	if (!response.ok) {
		throw new GraphQLRequestError(`GraphQL request failed with HTTP ${response.status}`);
	}

	let body: GraphQLResponse<T>;
	try {
		body = (await response.json()) as GraphQLResponse<T>;
	} catch (cause) {
		throw new GraphQLRequestError("GraphQL response was not valid JSON", { cause });
	}

	if (body.errors && body.errors.length > 0) {
		throw new GraphQLRequestError(body.errors.map((e) => e.message).join("; "));
	}
	if (!body.data) {
		throw new GraphQLRequestError("GraphQL response contained no data");
	}
	return body.data;
}
