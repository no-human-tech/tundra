/**
 * Identity and account model — users, the providers they authenticate through,
 * and the external identities that link a user to a provider subject.
 *
 * Pure types plus deterministic helpers (email normalization, identity keys,
 * conflict detection). No I/O, no live provider integration.
 *
 * See architect auth-foundation report §identity.
 */

import type { Entity, ExternalIdentityId, ISODateString, UserId } from "./ids.js";

/** The class of authentication mechanism an identity provider implements. */
export enum IdentityProviderKind {
	Email = "email",
	OAuth = "oauth",
	Oidc = "oidc",
	Saml = "saml",
}

/** Lifecycle state of a user account. */
export enum UserStatus {
	Active = "active",
	Invited = "invited",
	Suspended = "suspended",
	Deactivated = "deactivated",
}

/** A configured way to authenticate (an OIDC issuer, a SAML IdP, email/password, …). */
export interface IdentityProvider {
	id: string;
	kind: IdentityProviderKind;
	displayName: string;
	/** Issuer URL for OIDC/SAML providers; unset for email. */
	issuer?: string;
	enabled: boolean;
}

/** A link between a Tundra user and a subject at a specific identity provider. */
export interface ExternalIdentity extends Entity<ExternalIdentityId> {
	userId: UserId;
	providerId: string;
	/** Stable subject identifier issued by the provider (e.g. OIDC `sub`). */
	subject: string;
	email?: string;
	emailVerified: boolean;
	linkedAt: ISODateString;
}

/** A Tundra user account. */
export interface User extends Entity<UserId> {
	primaryEmail: string;
	emailVerified: boolean;
	displayName: string;
	status: UserStatus;
}

/**
 * Canonicalize an email for comparison and storage: trim surrounding whitespace
 * and lowercase. This is the single rule used everywhere emails are compared.
 *
 * @param email Raw email as supplied by a provider or user input.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Compose the stable lookup key for an external identity from its provider and
 * subject. The `(providerId, subject)` pair is globally unique.
 *
 * @param providerId Id of the identity provider.
 * @param subject Provider-issued subject identifier.
 */
export function identityKey(providerId: string, subject: string): string {
	return `${providerId}:${subject}`;
}

/** A reason a candidate external identity cannot be linked. */
export enum IdentityConflict {
	ProviderSubjectTaken = "provider_subject_taken",
	EmailLinkedToOtherUser = "email_linked_to_other_user",
}

/**
 * Detect whether linking a candidate external identity would collide with an
 * existing one.
 *
 * Returns {@link IdentityConflict.ProviderSubjectTaken} when the
 * `(providerId, subject)` pair already maps to a *different* user;
 * {@link IdentityConflict.EmailLinkedToOtherUser} when the candidate's
 * normalized email already belongs to an identity owned by a *different* user;
 * otherwise `null` (consistent re-link of the same user, or a fresh identity).
 *
 * The `candidate` is the identity a caller intends to link (its user, provider,
 * subject, and optional email).
 *
 * @param existing Already-stored external identities to check against.
 */
export function findIdentityConflict(
	existing: readonly ExternalIdentity[],
	candidate: { userId: UserId; providerId: string; subject: string; email?: string },
): IdentityConflict | null {
	for (const identity of existing) {
		if (
			identity.providerId === candidate.providerId &&
			identity.subject === candidate.subject &&
			identity.userId !== candidate.userId
		) {
			return IdentityConflict.ProviderSubjectTaken;
		}
	}

	if (candidate.email !== undefined) {
		const candidateEmail = normalizeEmail(candidate.email);
		for (const identity of existing) {
			if (identity.email === undefined) {
				continue;
			}
			if (
				normalizeEmail(identity.email) === candidateEmail &&
				identity.userId !== candidate.userId
			) {
				return IdentityConflict.EmailLinkedToOtherUser;
			}
		}
	}

	return null;
}
