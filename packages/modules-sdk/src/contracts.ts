/**
 * SDK contracts module authors build against.
 *
 * Re-exports the manifest/extension-point types from `@tundra/domain` (their
 * canonical home) and defines the SDK-only backend contracts: `WorkItemProvider`,
 * `PermissionHook`, and `ProviderContext`.
 *
 * See architect report 01 §4 and ADR-0005.
 */

import type {
	ExtensionPoint,
	ModuleManifest,
	ProjectId,
	UserId,
	WorkItem,
	WorkItemSource,
	WorkspaceId,
} from "@tundra/domain";

// Re-export the canonical manifest/extension-point contracts so module authors
// import them from a single SDK entry point.
export type { ModuleManifest, ExtensionPoint };
export { ExtensionPointKind } from "@tundra/domain";

/**
 * Read-only context the host supplies to backend extensions. Modules never get
 * raw db handles; future host-supplied accessors hang off this object.
 */
export interface ProviderContext {
	userId?: UserId;
	workspaceId: WorkspaceId;
}

/**
 * A backend extension point that feeds WorkItems into the unified read model.
 * The worker reconciles the returned items (architect §3).
 */
export interface WorkItemProvider {
	source: WorkItemSource;
	/** Pull the current WorkItems for a project. */
	listForProject(ctx: ProviderContext, projectId: ProjectId): Promise<WorkItem[]>;
}

/**
 * A backend extension point that authorizes actions. Hooks are composed with AND
 * across all registered modules: any `false` denies.
 */
export interface PermissionHook {
	can(
		ctx: ProviderContext,
		action: string,
		subject: Record<string, unknown>,
	): boolean | Promise<boolean>;
}
