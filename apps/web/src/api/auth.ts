/**
 * REST auth client helpers for the Tundra web app.
 *
 * Authentication uses HTTP-only session cookies set by the API. These helpers
 * call the REST auth endpoints (not GraphQL) with `credentials: "include"` so
 * the browser sends and receives cookies automatically. The GraphQL client also
 * sends cookies via `credentials: "include"` so the context factory on the API
 * can resolve the session without a separate header.
 */

/** Derive the REST base URL from the configured GraphQL endpoint. */
function authBase(): string {
	const gql = import.meta.env.VITE_API_URL ?? "http://localhost:4000/graphql";
	return gql.replace(/\/graphql$/, "");
}

/** Successful auth response from the API. */
export interface AuthSuccess {
	userId: string;
}

/** Auth error response from the API. */
export interface AuthError {
	error: string;
}

async function authPost(
	path: string,
	body: Record<string, string>,
): Promise<AuthSuccess | AuthError> {
	const res = await fetch(`${authBase()}${path}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		credentials: "include",
		body: JSON.stringify(body),
	});
	return res.json() as Promise<AuthSuccess | AuthError>;
}

/** POST /auth/login — validates credentials and opens a session cookie. */
export function loginRequest(email: string, password: string): Promise<AuthSuccess | AuthError> {
	return authPost("/auth/login", { email, password });
}

/** POST /auth/register — creates an account and opens a session cookie. */
export function registerRequest(
	email: string,
	password: string,
	displayName: string,
): Promise<AuthSuccess | AuthError> {
	return authPost("/auth/register", { email, password, displayName });
}

/** POST /auth/logout — invalidates the current session and clears the cookie. */
export async function logoutRequest(): Promise<void> {
	await fetch(`${authBase()}/auth/logout`, {
		method: "POST",
		credentials: "include",
	});
}
