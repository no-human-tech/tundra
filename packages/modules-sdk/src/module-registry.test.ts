import { describe, expect, it } from "vitest";

import {
	ExtensionPointKind,
	WorkItemPriority,
	WorkItemSource,
	WorkItemStatus,
} from "@tundra/domain";
import type {
	ModuleId,
	ModuleManifest,
	ProjectId,
	WorkItem,
	WorkItemId,
	WorkspaceId,
} from "@tundra/domain";

import { ModuleRegistry } from "./module-registry.js";
import { SLOTS } from "./slots.js";
import type { NavExtensionPoint } from "./slots.js";
import type { ProviderContext, WorkItemProvider } from "./contracts.js";

function navPoint(slot: NavExtensionPoint["slot"], route: string): NavExtensionPoint {
	return { kind: ExtensionPointKind.NavEntry, surface: "frontend", slot, route, label: "Helpdesk" };
}

function helpdeskManifest(overrides: Partial<ModuleManifest> = {}): ModuleManifest {
	return {
		id: "mod-helpdesk" as ModuleId,
		name: "Helpdesk",
		version: "1.0.0",
		description: "Helpdesk tickets as WorkItems.",
		author: "Tundra",
		permissions: ["workitem:read", "project:nav"],
		providesWorkItemSources: [WorkItemSource.Extension],
		contributes: [
			navPoint(SLOTS.projectNav, "/projects/:projectId/helpdesk"),
			{
				kind: ExtensionPointKind.WorkItemProvider,
				surface: "backend",
				slot: SLOTS.workitemProviders,
			},
		],
		...overrides,
	};
}

describe("ModuleRegistry", () => {
	it("routes a registered module's contributions to the right slots", () => {
		const registry = new ModuleRegistry();
		registry.register(helpdeskManifest());

		expect(registry.list()).toHaveLength(1);
		expect(registry.getModule("mod-helpdesk" as ModuleId)?.name).toBe("Helpdesk");

		const navContribs = registry.contributionsForSlot(SLOTS.projectNav);
		expect(navContribs).toHaveLength(1);
		expect(navContribs[0]?.moduleId).toBe("mod-helpdesk");

		const providerContribs = registry.contributionsForSlot(SLOTS.workitemProviders);
		expect(providerContribs).toHaveLength(1);

		// unrelated slots are empty
		expect(registry.contributionsForSlot(SLOTS.dashboardWidgets)).toHaveLength(0);
	});

	it("rejects a duplicate module id", () => {
		const registry = new ModuleRegistry();
		registry.register(helpdeskManifest());
		expect(() => registry.register(helpdeskManifest())).toThrow(/Duplicate module id/);
	});

	it("rejects a project.nav contribution that targets a global route", () => {
		const registry = new ModuleRegistry();
		const bad = helpdeskManifest({
			contributes: [navPoint(SLOTS.projectNav, "/dashboard")],
		});
		expect(() => registry.register(bad)).toThrow(/Nav scope violation/);
		// registration is atomic: nothing was recorded
		expect(registry.list()).toHaveLength(0);
	});

	it("rejects a global.nav contribution that targets a project route", () => {
		const registry = new ModuleRegistry();
		const bad = helpdeskManifest({
			contributes: [navPoint(SLOTS.globalNav, "/projects/:projectId/overview")],
		});
		expect(() => registry.register(bad)).toThrow(/Nav scope violation/);
	});

	it("accepts a global.nav contribution that targets a global route", () => {
		const registry = new ModuleRegistry();
		const ok = helpdeskManifest({
			id: "mod-global" as ModuleId,
			contributes: [navPoint(SLOTS.globalNav, "/extensions")],
		});
		expect(() => registry.register(ok)).not.toThrow();
		expect(registry.contributionsForSlot(SLOTS.globalNav)).toHaveLength(1);
	});

	it("discovers a registered WorkItemProvider that yields valid WorkItems", async () => {
		const registry = new ModuleRegistry();
		const projectId = "proj-1" as ProjectId;

		const provider: WorkItemProvider = {
			source: WorkItemSource.Extension,
			async listForProject(_ctx: ProviderContext, pid: ProjectId): Promise<WorkItem[]> {
				return [
					{
						id: "wi-ext-1" as WorkItemId,
						projectId: pid,
						source: WorkItemSource.Extension,
						sourceRef: {
							source: WorkItemSource.Extension,
							refId: "ticket-1",
							moduleId: "mod-helpdesk" as ModuleId,
						},
						title: "Helpdesk ticket #1",
						status: WorkItemStatus.Todo,
						priority: WorkItemPriority.High,
						createdAt: "2026-06-01T00:00:00.000Z",
						updatedAt: "2026-06-01T00:00:00.000Z",
					},
				];
			},
		};

		registry.registerWorkItemProvider(provider);
		const discovered = registry.workItemProviders();
		expect(discovered).toHaveLength(1);

		const items = await discovered[0]!.listForProject(
			{ workspaceId: "ws-1" as WorkspaceId },
			projectId,
		);
		expect(items).toHaveLength(1);
		const item = items[0]!;
		expect(item.source).toBe(WorkItemSource.Extension);
		expect(item.projectId).toBe(projectId);
		expect(item.sourceRef.refId).toBe("ticket-1");
		expect(typeof item.title).toBe("string");
	});
});
