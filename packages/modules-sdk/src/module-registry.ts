/**
 * ModuleRegistry — the authoritative, in-memory index of registered modules.
 *
 * On registration the registry:
 *  - rejects duplicate module ids,
 *  - validates nav contributions against their slot's required route scope
 *    (`global.nav` -> global routes, `project.nav` -> project routes) via
 *    `assertNavScope`, rejecting violations,
 *  - indexes every contribution by slot for fast `contributionsForSlot` lookups.
 *
 * It also tracks registered `WorkItemProvider`s so the worker can discover them.
 *
 * See architect report 01 §4.
 */

import { assertNavScope } from "@tundra/domain";
import type { ExtensionPoint, ModuleId, ModuleManifest } from "@tundra/domain";

import { NAV_SLOT_SCOPE, SLOTS, isNavContribution } from "./slots.js";
import type { WorkItemProvider } from "./contracts.js";

/** A contribution paired with the module that declared it. */
export interface SlotContribution {
	moduleId: ModuleId;
	point: ExtensionPoint;
}

export class ModuleRegistry {
	private readonly modules = new Map<ModuleId, ModuleManifest>();
	private readonly bySlot = new Map<string, SlotContribution[]>();
	private readonly providers: WorkItemProvider[] = [];

	/**
	 * Register a module from its manifest. Throws on a duplicate id or on a nav
	 * contribution whose route does not match its slot's scope.
	 */
	register(manifest: ModuleManifest): void {
		if (this.modules.has(manifest.id)) {
			throw new Error(`Duplicate module id: ${String(manifest.id)}`);
		}

		// Validate nav scope BEFORE recording anything so registration is atomic.
		for (const point of manifest.contributes) {
			if (isNavContribution(point)) {
				const required = NAV_SLOT_SCOPE[point.slot];
				// required is always defined for nav slots; assertNavScope throws on mismatch.
				if (required !== undefined) {
					assertNavScope(point.route, required);
				}
			}
		}

		this.modules.set(manifest.id, manifest);
		for (const point of manifest.contributes) {
			const list = this.bySlot.get(point.slot) ?? [];
			list.push({ moduleId: manifest.id, point });
			this.bySlot.set(point.slot, list);
		}
	}

	/**
	 * Register a backend WorkItemProvider implementation. Kept separate from the
	 * manifest because providers carry executable code, not just declarations.
	 */
	registerWorkItemProvider(provider: WorkItemProvider): void {
		this.providers.push(provider);
	}

	getModule(id: ModuleId): ModuleManifest | undefined {
		return this.modules.get(id);
	}

	list(): ModuleManifest[] {
		return [...this.modules.values()];
	}

	/** All contributions targeting a given slot, in registration order. */
	contributionsForSlot(slot: string): SlotContribution[] {
		return this.bySlot.get(slot) ?? [];
	}

	/** Discoverable backend WorkItem providers (architect §3 reconciliation). */
	workItemProviders(): WorkItemProvider[] {
		return [...this.providers];
	}

	/** Convenience: declared nav contributions for both nav slots. */
	navContributions(): SlotContribution[] {
		return [
			...this.contributionsForSlot(SLOTS.globalNav),
			...this.contributionsForSlot(SLOTS.projectNav),
		];
	}
}
