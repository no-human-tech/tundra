/**
 * Postgres enum types mirroring the canonical `@tundra/domain` enums.
 *
 * The enum *values* are sourced from the domain enums so the database can never
 * drift from the domain contract. (Drizzle's `pgEnum` requires a non-empty
 * readonly tuple of string literals, which we build from `Object.values`.)
 */

import { pgEnum } from "drizzle-orm/pg-core";
import {
	ActionSource,
	IdentityProviderKind,
	ProjectRole,
	Reversibility,
	UserStatus,
	WorkItemPriority,
	WorkItemSource,
	WorkItemStatus,
	WorkspaceRole,
} from "@tundra/domain";

/** Cast an enum's string values into the non-empty tuple `pgEnum` expects. */
function values<T extends Record<string, string>>(e: T): [string, ...string[]] {
	return Object.values(e) as [string, ...string[]];
}

export const projectRoleEnum = pgEnum("project_role", values(ProjectRole));
export const workItemSourceEnum = pgEnum("work_item_source", values(WorkItemSource));
export const workItemStatusEnum = pgEnum("work_item_status", values(WorkItemStatus));
export const workItemPriorityEnum = pgEnum("work_item_priority", values(WorkItemPriority));

export const workspaceRoleEnum = pgEnum("workspace_role", values(WorkspaceRole));
export const userStatusEnum = pgEnum("user_status", values(UserStatus));
export const actionSourceEnum = pgEnum("action_source", values(ActionSource));
export const reversibilityEnum = pgEnum("reversibility", values(Reversibility));
export const identityProviderKindEnum = pgEnum(
	"identity_provider_kind",
	values(IdentityProviderKind),
);
