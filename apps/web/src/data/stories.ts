/**
 * User-story fixtures with checklist items.
 *
 * Story checklist items are first-class WorkItems: an assigned item appears in My
 * Tasks, and clicking it opens a drawer showing the parent story's full checklist
 * with the assigned item highlighted ("Appears in My Tasks").
 */

import { PEOPLE, type Person } from "./people.js";

export interface StoryChecklistItem {
	id: string;
	text: string;
	done: boolean;
	assignee: Person;
	/** true when this is the item assigned to the signed-in user (highlighted) */
	isMine?: boolean;
}

export interface UserStory {
	id: string;
	reference: string;
	title: string;
	projectKey: string;
	projectName: string;
	checklist: StoryChecklistItem[];
}

export const STORIES: Record<string, UserStory> = {
	"story-onboarding": {
		id: "story-onboarding",
		reference: "AUR-201",
		title: "Team onboarding",
		projectKey: "AUR",
		projectName: "Aurora Platform",
		checklist: [
			{ id: "cl-1", text: "Draft onboarding flow diagram", done: true, assignee: PEOPLE.sena },
			{
				id: "cl-2",
				text: "Prepare API contract",
				done: false,
				assignee: PEOPLE.mira,
				isMine: true,
			},
			{ id: "cl-3", text: "Wire welcome email automation", done: false, assignee: PEOPLE.aleks },
			{ id: "cl-4", text: "Add first-run product tour", done: false, assignee: PEOPLE.priya },
		],
	},
	"story-marketplace": {
		id: "story-marketplace",
		reference: "OSS-44",
		title: "Extension marketplace",
		projectKey: "OSS",
		projectName: "Tundra OSS",
		checklist: [
			{ id: "cl-5", text: "Module catalog grid layout", done: true, assignee: PEOPLE.sena },
			{
				id: "cl-6",
				text: "Add empty state copy for module gallery",
				done: false,
				assignee: PEOPLE.mira,
				isMine: true,
			},
			{ id: "cl-7", text: "Wire enable/disable toggles", done: false, assignee: PEOPLE.priya },
		],
	},
	"story-maintainer": {
		id: "story-maintainer",
		reference: "GLC-12",
		title: "New maintainer onboarding",
		projectKey: "GLC",
		projectName: "Glacier Docs",
		checklist: [
			{ id: "cl-8", text: "Document contribution workflow", done: true, assignee: PEOPLE.sena },
			{
				id: "cl-9",
				text: "Create onboarding checklist template",
				done: false,
				assignee: PEOPLE.mira,
				isMine: true,
			},
			{ id: "cl-10", text: "Set up reviewer rotation", done: false, assignee: PEOPLE.aleks },
		],
	},
};

export function findStory(id: string | undefined): UserStory | undefined {
	return id ? STORIES[id] : undefined;
}
