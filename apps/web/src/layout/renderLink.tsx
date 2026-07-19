import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import type { NavItem } from "@tundra/ui";

/**
 * Injects a React Router <Link> into the routing-agnostic nav components. The
 * `ui` package never imports react-router; the app supplies link behavior here.
 */
export function renderLink(item: NavItem, children: ReactNode): ReactNode {
	return (
		<Link
			to={item.href}
			className="tnd-nav__link"
			aria-current={item.isActive ? "page" : undefined}
		>
			{children}
		</Link>
	);
}
