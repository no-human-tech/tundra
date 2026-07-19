/**
 * @tundra/modules-sdk — the public SDK module authors build against.
 *
 * Depends only on `@tundra/domain`. Provides the manifest/extension-point
 * contracts, the backend `WorkItemProvider` / `PermissionHook` interfaces, the
 * named slot constants, and an in-memory `ModuleRegistry`.
 *
 * See architect report 01 §4 and ADR-0005.
 */

export type {
	ModuleManifest,
	ExtensionPoint,
	ProviderContext,
	WorkItemProvider,
	PermissionHook,
} from "./contracts.js";
export { ExtensionPointKind } from "./contracts.js";

export { SLOTS, NAV_SLOT_SCOPE, isNavContribution, navContributionScopeMatches } from "./slots.js";
export type { SlotName, NavExtensionPoint } from "./slots.js";

export { ModuleRegistry } from "./module-registry.js";
export type { SlotContribution } from "./module-registry.js";

export {
	INBOUND_TOPIC_PREFIX,
	OUTBOUND_WORKITEM_TOPIC,
	OUTBOUND_AUDIT_TOPIC,
	parseInboundMessage,
} from "./integration.js";
export type {
	InboundIntegrationMessage,
	InboundWorkItemUpsert,
	InboundParseError,
} from "./integration.js";
