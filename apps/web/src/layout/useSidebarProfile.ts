import type { TFunction } from "i18next";
import type { GlobalNavigationProfile } from "@tundra/ui";

import { useAuth } from "../auth/AuthContext.js";

/**
 * Builds the `<GlobalNavigation profile>` card from the real signed-in viewer
 * (the design spec §6/§7.4 — avatar, name, role). Returns `undefined` when no
 * one is signed in (e.g. the demo-fallback routes reachable without a session)
 * so the card is omitted entirely rather than showing placeholder identity.
 *
 * The role label reuses the `admin.members.role.*` strings (already translated
 * in all 9 locales for the workspace-members screen) instead of introducing a
 * parallel set of role translations.
 */
export function useSidebarProfile(t: TFunction): GlobalNavigationProfile | undefined {
	const { viewer } = useAuth();
	if (!viewer) return undefined;

	const roleKey = viewer.workspaceRole ?? "member";
	const meta = t(`admin.members.role.${roleKey}` as never, {
		defaultValue: roleKey.charAt(0).toUpperCase() + roleKey.slice(1),
	});

	return { name: viewer.displayName, meta };
}
