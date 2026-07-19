import { describe, expect, it } from "vitest";

import { IdentityConflict, findIdentityConflict, identityKey, normalizeEmail } from "./identity.js";
import type { ExternalIdentity } from "./identity.js";
import type { ExternalIdentityId, UserId } from "./ids.js";

const ada = "user-ada" as UserId;
const bob = "user-bob" as UserId;

function identity(
	overrides: Partial<ExternalIdentity> &
		Pick<ExternalIdentity, "id" | "userId" | "providerId" | "subject">,
): ExternalIdentity {
	return {
		emailVerified: true,
		linkedAt: "2026-06-01T00:00:00.000Z",
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
		...overrides,
	};
}

describe("normalizeEmail", () => {
	it("trims surrounding whitespace and lowercases", () => {
		expect(normalizeEmail("  Ada.Lovelace@Example.COM  ")).toBe("ada.lovelace@example.com");
	});

	it("is idempotent", () => {
		const once = normalizeEmail("  MiXeD@Case.io ");
		expect(normalizeEmail(once)).toBe(once);
	});
});

describe("identityKey", () => {
	it("joins provider and subject with a colon", () => {
		expect(identityKey("google", "sub-123")).toBe("google:sub-123");
	});
});

describe("findIdentityConflict", () => {
	it("returns ProviderSubjectTaken for the same (provider, subject) on a different user", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "google",
				subject: "sub-1",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: bob,
			providerId: "google",
			subject: "sub-1",
		});
		expect(conflict).toBe(IdentityConflict.ProviderSubjectTaken);
	});

	it("returns EmailLinkedToOtherUser for a duplicate normalized email on a different user", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "google",
				subject: "sub-1",
				email: "Ada@Example.com",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: bob,
			providerId: "github",
			subject: "sub-2",
			email: "  ADA@example.COM ",
		});
		expect(conflict).toBe(IdentityConflict.EmailLinkedToOtherUser);
	});

	it("returns null when the same user re-links the same (provider, subject)", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "google",
				subject: "sub-1",
				email: "ada@example.com",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: ada,
			providerId: "google",
			subject: "sub-1",
			email: "ada@example.com",
		});
		expect(conflict).toBeNull();
	});

	it("returns null for a fresh identity that collides with nothing", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "google",
				subject: "sub-1",
				email: "ada@example.com",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: bob,
			providerId: "github",
			subject: "sub-2",
			email: "bob@example.com",
		});
		expect(conflict).toBeNull();
	});

	it("ignores stored identities that have no email when checking by email", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "saml",
				subject: "sub-1",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: bob,
			providerId: "github",
			subject: "sub-2",
			email: "bob@example.com",
		});
		expect(conflict).toBeNull();
	});

	it("does not flag an email conflict when the candidate has no email", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "google",
				subject: "sub-1",
				email: "ada@example.com",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: bob,
			providerId: "github",
			subject: "sub-2",
		});
		expect(conflict).toBeNull();
	});

	it("does not flag an email conflict when the same email belongs to the same user", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "google",
				subject: "sub-1",
				email: "ada@example.com",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: ada,
			providerId: "github",
			subject: "sub-2",
			email: "ada@example.com",
		});
		expect(conflict).toBeNull();
	});

	it("prefers ProviderSubjectTaken over an email conflict when both apply", () => {
		const existing: ExternalIdentity[] = [
			identity({
				id: "ext-1" as ExternalIdentityId,
				userId: ada,
				providerId: "google",
				subject: "sub-1",
				email: "ada@example.com",
			}),
		];
		const conflict = findIdentityConflict(existing, {
			userId: bob,
			providerId: "google",
			subject: "sub-1",
			email: "ada@example.com",
		});
		expect(conflict).toBe(IdentityConflict.ProviderSubjectTaken);
	});
});
