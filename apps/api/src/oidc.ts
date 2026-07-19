/**
 * OIDC login against a central identity provider (Keycloak) — Authorization
 * Code flow with PKCE via `openid-client`.
 *
 * Transaction state (state + nonce + PKCE verifier) travels in an HMAC-signed,
 * short-lived, HTTP-only cookie rather than server memory, so any API replica
 * can complete a login started by another one. Format mirrors the GitHub OAuth
 * state token: `${base64url(json)}.${ts}.${hmac}` signed with the OIDC client
 * secret.
 *
 * Sessions are unchanged: a successful callback resolves the user through
 * `DataSource.loginWithOidc` and issues the regular DB-backed session cookie.
 * The IdP is only the authentication authority.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import * as oidc from "openid-client";
import type { OidcConfig } from "@tundra/config";
import type { IdpWorkspaceRole } from "@tundra/db";

/** Transaction cookie lifetime in milliseconds (10 minutes). */
const TXN_TTL_MS = 10 * 60 * 1000;

/** Name of the short-lived OIDC transaction cookie. */
export const OIDC_TXN_COOKIE_NAME = "tundra.oidc";

/** The per-login transaction carried between /start and /callback. */
export interface OidcTransaction {
	state: string;
	nonce: string;
	verifier: string;
}

/** Sign a transaction into an opaque cookie value. */
export function signTransaction(
	txn: OidcTransaction,
	secret: string,
	nowMs: number = Date.now(),
): string {
	const payload = Buffer.from(JSON.stringify(txn)).toString("base64url");
	const ts = Math.floor(nowMs / 1000).toString();
	const hmac = createHmac("sha256", secret).update(`${payload}.${ts}`).digest("hex");
	return `${payload}.${ts}.${hmac}`;
}

/**
 * Verify and decode a transaction cookie value.
 *
 * Returns the transaction on success, or `null` for any malformed, expired, or
 * tampered value (callers redirect back to /login with a generic error).
 */
export function verifyTransaction(
	value: string | null,
	secret: string,
	nowMs: number = Date.now(),
): OidcTransaction | null {
	if (!value) return null;
	const parts = value.split(".");
	if (parts.length !== 3) return null;
	const [payload, ts, receivedHmac] = parts as [string, string, string];

	const issuedAtMs = parseInt(ts, 10) * 1000;
	if (Number.isNaN(issuedAtMs) || nowMs - issuedAtMs > TXN_TTL_MS) return null;

	if (!/^[0-9a-f]{64}$/.test(receivedHmac)) return null;
	const expectedHex = createHmac("sha256", secret).update(`${payload}.${ts}`).digest("hex");
	if (!timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(receivedHmac, "hex"))) {
		return null;
	}

	try {
		const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as OidcTransaction;
		if (!parsed.state || !parsed.nonce || !parsed.verifier) return null;
		return parsed;
	} catch {
		return null;
	}
}

/**
 * Map IdP role/group claims onto a Tundra workspace role.
 *
 * Accepts both shapes Keycloak can emit for the `tundra` client: client roles
 * (`resource_access.tundra.roles`, granted through the
 * `organizacje/no-human/tundra/<role>` groups) and raw group paths (when a
 * groups mapper is configured). `admin` wins over `user`; everything else is a
 * plain member.
 */
export function mapIdpRoles(roles: readonly string[], groups: readonly string[]): IdpWorkspaceRole {
	if (roles.includes("admin") || groups.some((g) => g.endsWith("/tundra/admin"))) {
		return "admin";
	}
	return "member";
}

/** The identity profile extracted from a successful OIDC callback. */
export interface OidcLoginProfile {
	/** Stable `sub` claim at the issuer. */
	subject: string;
	/** Email claim when `email_verified` was asserted true; null otherwise. */
	verifiedEmail: string | null;
	/** Best-effort display name (`name` → `preferred_username`). */
	name: string | null;
	/** Workspace role mapped from the token's role/group claims. */
	workspaceRole: IdpWorkspaceRole;
}

/** Stable error codes surfaced to the login page via `?error=`. */
export type OidcCallbackError = "oidc_txn_invalid" | "oidc_exchange_failed" | "oidc_claims_missing";

/**
 * The narrow OIDC port `buildApp` consumes. The real implementation
 * ({@link createOidcAuth}) wraps `openid-client`; tests substitute a stub so
 * route behaviour is testable without an IdP.
 */
export interface OidcAuth {
	/** Build the authorization redirect and its signed transaction cookie value. */
	start(): Promise<{ authorizationUrl: string; txnCookieValue: string }>;
	/** Complete the code exchange for the current callback URL. */
	callback(
		currentUrl: URL,
		txnCookieValue: string | null,
	): Promise<OidcLoginProfile | { error: OidcCallbackError }>;
	/** RP-initiated logout URL at the IdP, or null when unsupported. */
	endSessionUrl(postLogoutRedirect: string): Promise<string | null>;
}

/** Decode a JWT payload without verifying it (see call site for why that is safe). */
function decodeJwtPayload(jwt: string | undefined): Record<string, unknown> | null {
	if (!jwt) return null;
	const parts = jwt.split(".");
	if (parts.length !== 3) return null;
	try {
		return JSON.parse(Buffer.from(parts[1] as string, "base64url").toString()) as Record<
			string,
			unknown
		>;
	} catch {
		return null;
	}
}

/** Pull `resource_access.<clientId>.roles` and `groups` out of a claims object. */
function extractRolesAndGroups(
	claims: Record<string, unknown> | null,
	clientId: string,
): { roles: string[]; groups: string[] } {
	if (!claims) return { roles: [], groups: [] };
	const resourceAccess = claims["resource_access"] as
		Record<string, { roles?: unknown }> | undefined;
	const rawRoles = resourceAccess?.[clientId]?.roles;
	const roles = Array.isArray(rawRoles) ? rawRoles.filter((r) => typeof r === "string") : [];
	const rawGroups = claims["groups"];
	const groups = Array.isArray(rawGroups) ? rawGroups.filter((g) => typeof g === "string") : [];
	return { roles, groups };
}

/**
 * Create the production {@link OidcAuth} backed by `openid-client`.
 *
 * Discovery is lazy and cached: the first login attempt fetches the issuer
 * metadata, so constructing the auth (and thus `buildApp`) stays free of I/O.
 */
export function createOidcAuth(config: OidcConfig): OidcAuth {
	let discovered: Promise<oidc.Configuration> | null = null;
	const getConfiguration = (): Promise<oidc.Configuration> => {
		discovered ??= oidc.discovery(new URL(config.issuerUrl), config.clientId, config.clientSecret);
		return discovered;
	};

	return {
		async start() {
			const configuration = await getConfiguration();
			const verifier = oidc.randomPKCECodeVerifier();
			const challenge = await oidc.calculatePKCECodeChallenge(verifier);
			const state = oidc.randomState();
			const nonce = oidc.randomNonce();

			const authorizationUrl = oidc.buildAuthorizationUrl(configuration, {
				redirect_uri: config.redirectUrl,
				scope: "openid profile email",
				code_challenge: challenge,
				code_challenge_method: "S256",
				state,
				nonce,
			});

			return {
				authorizationUrl: authorizationUrl.toString(),
				txnCookieValue: signTransaction({ state, nonce, verifier }, config.clientSecret),
			};
		},

		async callback(currentUrl, txnCookieValue) {
			const txn = verifyTransaction(txnCookieValue, config.clientSecret);
			if (!txn) {
				return { error: "oidc_txn_invalid" };
			}

			let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
			try {
				const configuration = await getConfiguration();
				tokens = await oidc.authorizationCodeGrant(configuration, currentUrl, {
					pkceCodeVerifier: txn.verifier,
					expectedState: txn.state,
					expectedNonce: txn.nonce,
					idTokenExpected: true,
				});
			} catch {
				return { error: "oidc_exchange_failed" };
			}

			const claims = tokens.claims();
			if (!claims?.sub) {
				return { error: "oidc_claims_missing" };
			}

			// Keycloak puts client roles in the ACCESS token by default
			// (`resource_access.tundra.roles`); a groups/roles mapper may add them
			// to the ID token as well. The access token arrived directly from the
			// token endpoint over TLS, so decoding its payload without a second
			// signature check does not weaken authentication (the ID token itself
			// was fully validated by openid-client).
			const fromIdToken = extractRolesAndGroups(claims as Record<string, unknown>, config.clientId);
			const fromAccessToken = extractRolesAndGroups(
				decodeJwtPayload(tokens.access_token),
				config.clientId,
			);
			const workspaceRole = mapIdpRoles(
				[...fromIdToken.roles, ...fromAccessToken.roles],
				[...fromIdToken.groups, ...fromAccessToken.groups],
			);

			const emailVerified = claims["email_verified"] === true;
			const email = typeof claims["email"] === "string" ? claims["email"] : null;
			const name =
				typeof claims["name"] === "string"
					? claims["name"]
					: typeof claims["preferred_username"] === "string"
						? claims["preferred_username"]
						: null;

			return {
				subject: claims.sub,
				verifiedEmail: emailVerified ? email : null,
				name,
				workspaceRole,
			};
		},

		async endSessionUrl(postLogoutRedirect) {
			try {
				const configuration = await getConfiguration();
				const url = oidc.buildEndSessionUrl(configuration, {
					post_logout_redirect_uri: postLogoutRedirect,
					client_id: config.clientId,
				});
				return url.toString();
			} catch {
				return null;
			}
		},
	};
}
