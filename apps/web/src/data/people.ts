/**
 * People fixtures — the workspace members referenced across projects, the board,
 * timesheets, comments, and the My Tasks queue. Demo-only; the real app will
 * resolve members from the API.
 *
 * `Me` is the signed-in user (Mira Lindqvist in the comp); My Tasks pins the
 * Assignee filter to "Me".
 */

import type { AssigneeView } from "@tundra/ui";

export interface Person extends AssigneeView {
	id: string;
	name: string;
	/** short display name, e.g. "Mira L." */
	shortName: string;
	initials: string;
	/** role within the workspace */
	role: string;
}

export const PEOPLE = {
	mira: {
		id: "user-mira",
		name: "Mira Lindqvist",
		shortName: "Mira L.",
		initials: "ML",
		role: "Owner",
	},
	aleks: {
		id: "user-aleks",
		name: "Aleks Novak",
		shortName: "Aleks N.",
		initials: "AN",
		role: "Admin",
	},
	sena: {
		id: "user-sena",
		name: "Sena Okafor",
		shortName: "Sena O.",
		initials: "SO",
		role: "Member",
	},
	jonas: {
		id: "user-jonas",
		name: "Jonas Berg",
		shortName: "Jonas B.",
		initials: "JB",
		role: "Member",
	},
	priya: {
		id: "user-priya",
		name: "Priya Rao",
		shortName: "Priya R.",
		initials: "PR",
		role: "Member",
	},
} satisfies Record<string, Person>;

/** The signed-in user. My Tasks aggregates work assigned to this person. */
export const ME: Person = PEOPLE.mira;

export const ALL_PEOPLE: Person[] = Object.values(PEOPLE);
