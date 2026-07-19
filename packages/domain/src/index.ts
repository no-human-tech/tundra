/**
 * @tundra/domain — pure, dependency-free domain core.
 *
 * Entity types, the unified WorkItem model, enums, navigation rules, and the
 * "My Tasks" aggregation. No I/O, no framework, no db, no react. This is the
 * bottom of the dependency graph and the single source of conceptual truth.
 *
 * See architect report 01 §2–§5.
 */

// Branded ids + base entity shape.
export type {
	Id,
	ISODateString,
	Entity,
	WorkspaceId,
	ProjectId,
	UserId,
	ModuleId,
	WorkItemId,
	TaskId,
	UserStoryId,
	ChecklistItemId,
	SprintId,
	TimeEntryId,
	DocPageId,
	ReportId,
	AutomationId,
	ExternalIdentityId,
	AuditEventId,
	WorkspaceMembershipId,
} from "./ids.js";

// Enums (runtime values).
export {
	ProjectRole,
	WorkItemSource,
	WorkItemStatus,
	WorkItemPriority,
	ExtensionPointKind,
} from "./enums.js";

// Entity interfaces.
export type {
	Workspace,
	Project,
	ProjectMember,
	ExtensionSurface,
	ExtensionPoint,
	ModuleManifest,
	Module,
	Task,
	UserStory,
	ChecklistItem,
	Sprint,
	TimeEntry,
	DocPage,
	ReportKind,
	Report,
	AutomationAction,
} from "./entities.js";

// Unified WorkItem model.
export type { WorkItemSourceRef, WorkItem } from "./work-item.js";

// Navigation rules + constants.
export {
	GLOBAL_ROUTES,
	PROJECT_ROUTE_PATTERNS,
	navScopeOf,
	assertNavScope,
	GLOBAL_NAV,
	PROJECT_NAV,
} from "./navigation.js";
export type { NavScope, NavEntryDef } from "./navigation.js";

// "My Tasks" aggregation.
export { selectMyTasks, isActiveStatus } from "./aggregation.js";
export type { MyTasksFilter } from "./aggregation.js";

// Identity & accounts.
export {
	IdentityProviderKind,
	UserStatus,
	IdentityConflict,
	normalizeEmail,
	identityKey,
	findIdentityConflict,
} from "./identity.js";
export type { IdentityProvider, ExternalIdentity, User } from "./identity.js";

// Authorization — roles & permissions.
export { WorkspaceRole, permissionsForWorkspaceRole, permissionsForProjectRole } from "./authz.js";
export type { WorkspaceMembership, Permission } from "./authz.js";

// Resolved security context.
export { hasPermission, isWorkspaceAdmin } from "./auth-context.js";
export type { SessionPrincipal } from "./auth-context.js";

// Append-only audit log.
export { ActionSource, isReverted } from "./audit.js";
export type { AuditEvent } from "./audit.js";

// Reversibility & compensating events.
export {
	Reversibility,
	RevertDenyReason,
	canRevertAction,
	makeReversalEvent,
} from "./reversibility.js";
export type { ReversalPlan, RevertDecision, RevertContext } from "./reversibility.js";
