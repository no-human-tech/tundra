/**
 * GitHub OAuth helpers: stateless HMAC-signed state management and GitHub
 * API wrappers (no extra dependencies beyond Node built-ins and fetch).
 *
 * State format: `${nonce}.${ts}.${hmac}`
 *  - nonce: 16 random bytes as lowercase hex
 *  - ts:    Unix seconds as decimal string
 *  - hmac:  HMAC-SHA256(nonce + "." + ts, GITHUB_CLIENT_SECRET) as lowercase hex
 *
 * Single-use enforcement is delegated to a {@link NonceStore}: the in-memory
 * default matches single-process dev, while production injects the Redis store
 * so a nonce consumed on one API replica cannot be replayed on another within
 * the 15-minute state window. States are also time-limited, so stale nonces
 * cannot be replayed across restarts either way.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { NonceStore } from "./nonce-store.js";
import { createInMemoryNonceStore } from "./nonce-store.js";

/** State lifetime in milliseconds (15 minutes). */
const STATE_TTL_MS = 15 * 60 * 1000;

/** Fallback store when the caller injects none (single-process dev). */
const defaultNonceStore = createInMemoryNonceStore();

/**
 * Generate a signed, opaque OAuth state token.
 *
 * The token is safe to include in a redirect URI parameter; it carries its own
 * HMAC so no server-side state beyond the used-nonce set is required.
 */
export function generateState(secret: string): string {
	const nonce = randomBytes(16).toString("hex");
	const ts = Math.floor(Date.now() / 1000).toString();
	const hmac = createHmac("sha256", secret).update(`${nonce}.${ts}`).digest("hex");
	return `${nonce}.${ts}.${hmac}`;
}

export type StateValidationError = "invalid_format" | "expired" | "invalid_hmac" | "already_used";

/**
 * Validate and consume an OAuth state token.
 *
 * Returns `null` on success (the nonce is marked used in the given store).
 * Returns a {@link StateValidationError} string describing the failure mode.
 */
export async function validateState(
	state: string,
	secret: string,
	nonceStore: NonceStore = defaultNonceStore,
): Promise<StateValidationError | null> {
	const parts = state.split(".");
	if (parts.length !== 3) return "invalid_format";
	const [nonce, ts, receivedHmac] = parts as [string, string, string];

	// Check expiry before the HMAC to fail fast on obviously stale tokens.
	const issuedAtMs = parseInt(ts, 10) * 1000;
	if (Number.isNaN(issuedAtMs) || Date.now() - issuedAtMs > STATE_TTL_MS) {
		return "expired";
	}

	// Validate HMAC format (SHA-256 output = 64 lowercase hex chars).
	if (!/^[0-9a-f]{64}$/.test(receivedHmac)) return "invalid_hmac";

	const expectedHex = createHmac("sha256", secret).update(`${nonce}.${ts}`).digest("hex");
	const expectedBuf = Buffer.from(expectedHex, "hex");
	const receivedBuf = Buffer.from(receivedHmac, "hex");
	if (!timingSafeEqual(expectedBuf, receivedBuf)) return "invalid_hmac";

	// Single-use check (after HMAC passes so attackers can't poison the store).
	const consumed = await nonceStore.consume(`github:${nonce}.${ts}`, STATE_TTL_MS);
	if (!consumed) return "already_used";

	return null;
}

/** Minimal GitHub user profile from `/user`. */
export interface GitHubUserProfile {
	id: number;
	login: string;
	name: string | null;
	email: string | null;
}

/** Entry from the GitHub `/user/emails` endpoint. */
export interface GitHubEmailEntry {
	email: string;
	primary: boolean;
	verified: boolean;
}

/**
 * Exchange an OAuth authorization code for an access token.
 *
 * Returns the raw access token string, or `null` on any failure (network
 * error, GitHub error response, or missing token in the response body).
 */
export async function exchangeCodeForToken(
	code: string,
	clientId: string,
	clientSecret: string,
	callbackUrl: string,
): Promise<string | null> {
	let resp: Response;
	try {
		resp = await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
				"User-Agent": "Tundra/1.0",
			},
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code,
				redirect_uri: callbackUrl,
			}),
		});
	} catch {
		return null;
	}
	if (!resp.ok) return null;
	const data = (await resp.json()) as { access_token?: string; error?: string };
	if (data.error || !data.access_token) return null;
	return data.access_token;
}

/**
 * Fetch the authenticated GitHub user's basic profile.
 *
 * Returns `null` on network failure or non-2xx response.
 */
export async function fetchGitHubUser(token: string): Promise<GitHubUserProfile | null> {
	let resp: Response;
	try {
		resp = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "Tundra/1.0",
			},
		});
	} catch {
		return null;
	}
	if (!resp.ok) return null;
	return resp.json() as Promise<GitHubUserProfile>;
}

/**
 * Fetch the authenticated GitHub user's primary, verified email address.
 *
 * Uses the `/user/emails` endpoint (requires `user:email` scope). Returns
 * `null` when there is no primary-and-verified email or on any failure.
 */
export async function fetchGitHubVerifiedEmail(token: string): Promise<string | null> {
	let resp: Response;
	try {
		resp = await fetch("https://api.github.com/user/emails", {
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: "application/vnd.github+json",
				"User-Agent": "Tundra/1.0",
			},
		});
	} catch {
		return null;
	}
	if (!resp.ok) return null;
	const emails = (await resp.json()) as GitHubEmailEntry[];
	const primary = emails.find((e) => e.primary && e.verified);
	return primary?.email ?? null;
}
