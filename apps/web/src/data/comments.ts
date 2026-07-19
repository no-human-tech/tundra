/**
 * Recent-comment fixtures — shown on the dashboard "Recent comments" widget.
 * Discussions is a withdrawn module (the design spec §6); conversation now
 * lives in comments on tasks/stories/docs.
 */

import { PEOPLE, type Person } from "./people.js";

export interface RecentComment {
	id: string;
	title: string;
	author: Person;
	replies: number;
	/** relative time, e.g. "1h ago" */
	lastActivity: string;
	projectName: string;
}

export const RECENT_COMMENTS: RecentComment[] = [
	{
		id: "comment-1",
		title: "RFC: module manifest v2",
		author: PEOPLE.aleks,
		replies: 6,
		lastActivity: "1h ago",
		projectName: "Aurora Platform",
	},
	{
		id: "comment-2",
		title: "Docs IA for extension points",
		author: PEOPLE.sena,
		replies: 3,
		lastActivity: "4h ago",
		projectName: "Tundra OSS",
	},
	{
		id: "comment-3",
		title: "SDK: lifecycle hooks naming",
		author: PEOPLE.priya,
		replies: 9,
		lastActivity: "yesterday",
		projectName: "Aurora Platform",
	},
];
