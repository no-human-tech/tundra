/**
 * Docs / Wiki fixtures: a page tree and a sample page body for the project Docs
 * tab. Phase 2b renders the sidebar tree + markdown-like content + related tasks.
 */

export interface DocTreeNode {
	id: string;
	title: string;
	/** nesting depth (0 = top-level section) */
	depth: number;
	/** marks the currently-open page */
	active?: boolean;
}

export const DOCS_TREE: DocTreeNode[] = [
	{ id: "doc-getting-started", title: "Getting started", depth: 0 },
	{ id: "doc-architecture", title: "Architecture overview", depth: 1 },
	{ id: "doc-module-system", title: "Module system", depth: 1, active: true },
	{ id: "doc-extension-points", title: "Extension points", depth: 1 },
	{ id: "doc-writing-module", title: "Writing a module", depth: 0 },
	{ id: "doc-manifest", title: "Manifest schema", depth: 1 },
	{ id: "doc-lifecycle", title: "Lifecycle hooks", depth: 1 },
	{ id: "doc-api-reference", title: "API reference", depth: 0 },
];

export interface DocPageBlock {
	type: "heading" | "paragraph" | "list";
	text?: string;
	items?: string[];
}

export interface DocPage {
	id: string;
	title: string;
	updated: string;
	author: string;
	blocks: DocPageBlock[];
	/** related task references */
	relatedTasks: string[];
	/** related comment thread titles */
	relatedComments: string[];
}

export const SAMPLE_DOC_PAGE: DocPage = {
	id: "doc-module-system",
	title: "Module system",
	updated: "3h ago",
	author: "Priya Rao",
	blocks: [
		{
			type: "paragraph",
			text: "Tundra is built from modules — self-contained units that own a slice of the workspace. The core ships with Tasks; everything else (Board, Backlog, Sprints, Time, Docs, Comments, Reports) is a module that a project can enable or disable independently.",
		},
		{ type: "heading", text: "Module manifest" },
		{
			type: "paragraph",
			text: "Every module declares a manifest: its id, version, the extension points it contributes to, and the permissions it requires. The host validates the manifest at registration time and rejects scope violations.",
		},
		{ type: "heading", text: "Lifecycle" },
		{
			type: "list",
			items: [
				"register — the host reads the manifest and reserves slots",
				"enable — per-project activation; surfaces the module's tabs and widgets",
				"configure — per-module settings and permissions",
				"disable — graceful teardown; contributed slots fall back",
			],
		},
	],
	relatedTasks: ["AUR-119", "AUR-131"],
	relatedComments: ["RFC: module manifest v2", "SDK: lifecycle hooks naming"],
};
