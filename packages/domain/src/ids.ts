/**
 * Branded id types and shared primitives for the Tundra domain.
 *
 * Ids are branded string types so the compiler prevents passing, e.g., a
 * `ProjectId` where a `TaskId` is expected. At runtime they are plain strings.
 *
 * See architect report 01 §2.
 */

/**
 * A branded string id. `TBrand` is a phantom marker only; it has no runtime
 * representation. Use the `as` cast or a constructor helper to mint values.
 */
export type Id<TBrand extends string> = string & { readonly __brand: TBrand };

/** ISO 8601 timestamp string, e.g. "2026-06-27T12:00:00.000Z". */
export type ISODateString = string;

export type WorkspaceId = Id<"Workspace">;
export type ProjectId = Id<"Project">;
export type UserId = Id<"User">;
export type ModuleId = Id<"Module">;
export type WorkItemId = Id<"WorkItem">;
export type TaskId = Id<"Task">;
export type UserStoryId = Id<"UserStory">;
export type ChecklistItemId = Id<"ChecklistItem">;
export type SprintId = Id<"Sprint">;
export type TimeEntryId = Id<"TimeEntry">;
export type DocPageId = Id<"DocPage">;
export type ReportId = Id<"Report">;
export type AutomationId = Id<"AutomationAction">;
/** Id of an external identity linking a user to an identity-provider subject. */
export type ExternalIdentityId = Id<"ExternalIdentity">;
/** Id of an immutable audit-log event. */
export type AuditEventId = Id<"AuditEvent">;
/** Id of a workspace membership record. */
export type WorkspaceMembershipId = Id<"WorkspaceMembership">;

/**
 * Base shape for every persisted entity: a branded id plus audit timestamps.
 */
export interface Entity<TId> {
	id: TId;
	createdAt: ISODateString;
	updatedAt: ISODateString;
}
