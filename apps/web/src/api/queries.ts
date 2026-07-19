/**
 * Typed GraphQL operations + the `loadMyTasksView()` aggregator that powers the
 * live My Tasks screen.
 *
 * The query strings mirror the SDL in docs/agent-reports/persistence/02-api.md
 * §3/§9. We reuse the canonical `@tundra/domain` enums for source/status/priority
 * (the API emits the same string values) and the `@tundra/ui` `WorkItemView`
 * presentation type — nothing is redefined here.
 *
 * `loadMyTasksView()` fetches viewer + projects + myTasks, then JOINS the flat
 * API `WorkItem`s into display-ready `WorkItemView`s and buckets them into the
 * same grouped structure the demo fixtures use, so the page renders live and demo
 * data through one code path.
 */

import { WorkItemSource } from "@tundra/domain";
import type { WorkItemPriority, WorkItemStatus } from "@tundra/domain";
import type { WorkItemView } from "@tundra/ui";

import {
	MY_TASKS_GROUP_HINT,
	groupForWorkItem,
	groupMyTaskEntries,
	type MyTaskEntry,
	type MyTasksGroup,
} from "../data/index.js";
import { graphqlRequest } from "./client.js";

// --------------------------------------------------------------------- queries

const VIEWER_QUERY = /* GraphQL */ `
	query Viewer {
		viewer {
			userId
			displayName
			workspaceRole
			permissions
			isWorkspaceAdmin
		}
	}
`;

const PROJECTS_QUERY = /* GraphQL */ `
	query Projects {
		projects {
			id
			key
			name
		}
	}
`;

const MY_TASKS_QUERY = /* GraphQL */ `
	query MyTasks($assigneeId: ID) {
		myTasks(assigneeId: $assigneeId) {
			id
			projectId
			source
			status
			priority
			title
			assigneeId
			dueDate
			sourceRef {
				source
				moduleId
			}
		}
	}
`;

// ------------------------------------------------------------ response shapes

/** The resolved authorization context for the current request. */
export interface ApiViewer {
	userId: string;
	displayName: string;
	workspaceRole: string | null;
	permissions: string[];
	isWorkspaceAdmin: boolean;
}

export interface ApiProject {
	id: string;
	key: string;
	name: string;
}

interface ApiSourceRef {
	source: WorkItemSource;
	moduleId: string | null;
}

/** A unified work item as returned by `myTasks` (enum strings match the domain). */
export interface ApiWorkItem {
	id: string;
	projectId: string;
	source: WorkItemSource;
	status: WorkItemStatus;
	priority: WorkItemPriority;
	title: string;
	assigneeId: string | null;
	dueDate: string | null;
	sourceRef: ApiSourceRef | null;
}

/** Everything the My Tasks screen needs from the live API, post-join. */
export interface MyTasksView {
	viewer: ApiViewer;
	groups: MyTasksGroup[];
	/** flat entries (for the drawer lookup + metrics) */
	entries: MyTaskEntry[];
}

// --------------------------------------------------------------------- mapping

/** Today as a stable ISO `YYYY-MM-DD`, used to bucket live items into groups. */
function todayIso(): string {
	return new Date().toISOString().slice(0, 10);
}

/**
 * Build a display-ready `WorkItemView` from an API `WorkItem` by joining its
 * `projectId` to the project list (for key/name), attaching the viewer as the
 * assignee, and deriving the extension `moduleLabel` from `sourceRef.moduleId`.
 */
export function toWorkItemView(
	item: ApiWorkItem,
	projectsById: Map<string, ApiProject>,
	viewer: ApiViewer,
): WorkItemView {
	const project = projectsById.get(item.projectId);
	const isExtension = item.source === WorkItemSource.Extension;
	const moduleId = item.sourceRef?.moduleId ?? undefined;

	return {
		id: item.id,
		title: item.title,
		source: item.source,
		status: item.status,
		priority: item.priority,
		projectKey: project?.key ?? item.projectId,
		projectName: project?.name ?? item.projectId,
		dueAt: item.dueDate ?? undefined,
		// No real auth yet: myTasks is the viewer's queue, so the assignee is the viewer.
		assignee: { id: viewer.userId, name: viewer.displayName },
		// Extension sources label by their contributing module when one is present.
		moduleLabel: isExtension && moduleId ? moduleId : undefined,
	};
}

/**
 * Turn a joined `WorkItemView` into a queue `MyTaskEntry`: assign its group from
 * status + due date and synthesise a human `parent` label from the source. Live
 * items carry no story/estimate/comment metadata, so the drawer shows the generic
 * detail view rather than a parent-story checklist.
 */
function toEntry(view: WorkItemView, today: string): MyTaskEntry {
	return {
		item: view,
		group: groupForWorkItem(view.status, view.dueAt, today),
		parent: view.reference ? `${view.projectName} · ${view.reference}` : view.projectName,
	};
}

// --------------------------------------------------------------------- loader

/**
 * Fetch viewer + projects + myTasks from the live API and assemble the
 * `MyTasksView` the screen renders. Throws (via `graphqlRequest`) on any network
 * or GraphQL failure so the page can fall back to clearly-marked demo data.
 */
export async function loadMyTasksView(): Promise<MyTasksView> {
	const [{ viewer }, { projects }, { myTasks }] = await Promise.all([
		graphqlRequest<{ viewer: ApiViewer }>(VIEWER_QUERY),
		graphqlRequest<{ projects: ApiProject[] }>(PROJECTS_QUERY),
		graphqlRequest<{ myTasks: ApiWorkItem[] }>(MY_TASKS_QUERY),
	]);

	const projectsById = new Map(projects.map((p) => [p.id, p]));
	const today = todayIso();
	const entries = myTasks.map((item) => toEntry(toWorkItemView(item, projectsById, viewer), today));

	return { viewer, groups: groupMyTaskEntries(entries), entries };
}

// Re-exported so the page can label empty groups consistently with the demo path.
export { MY_TASKS_GROUP_HINT };

// --------------------------------------------------------------------- admin

const WORKSPACE_MEMBERS_QUERY = /* GraphQL */ `
	query WorkspaceMembers($workspaceId: ID!) {
		workspaceMembers(workspaceId: $workspaceId) {
			userId
			displayName
			primaryEmail
			role
			joinedAt
		}
	}
`;

const CHANGE_MEMBER_ROLE_MUTATION = /* GraphQL */ `
	mutation ChangeWorkspaceMemberRole($workspaceId: ID!, $userId: ID!, $role: String!) {
		changeWorkspaceMemberRole(workspaceId: $workspaceId, userId: $userId, role: $role) {
			eventId
		}
	}
`;

/** A workspace member as returned by `workspaceMembers`. */
export interface ApiWorkspaceMember {
	userId: string;
	displayName: string;
	primaryEmail: string;
	role: string;
	joinedAt: string;
}

/** Fetch the list of workspace members for a given workspace. */
export async function loadWorkspaceMembers(workspaceId: string): Promise<ApiWorkspaceMember[]> {
	const { workspaceMembers } = await graphqlRequest<{
		workspaceMembers: ApiWorkspaceMember[];
	}>(WORKSPACE_MEMBERS_QUERY, { workspaceId });
	return workspaceMembers;
}

/** Change a member's role. Returns the new audit event id on success. */
export async function changeMemberRole(
	workspaceId: string,
	userId: string,
	role: string,
): Promise<{ eventId: string }> {
	const { changeWorkspaceMemberRole } = await graphqlRequest<{
		changeWorkspaceMemberRole: { eventId: string };
	}>(CHANGE_MEMBER_ROLE_MUTATION, { workspaceId, userId, role });
	return changeWorkspaceMemberRole;
}

// ----------------------------------------------------------------- audit history

const AUDIT_HISTORY_QUERY = /* GraphQL */ `
	query AuditHistory($targetType: String!, $targetId: ID!) {
		auditHistory(targetType: $targetType, targetId: $targetId) {
			id
			actorUserId
			source
			action
			targetType
			targetId
			occurredAt
			reversibility
			irreversibleReason
			reversalOfEventId
			before
			after
		}
	}
`;

const REVERT_MUTATION = /* GraphQL */ `
	mutation RevertAuditEvent($eventId: ID!) {
		revertAuditEvent(eventId: $eventId) {
			allowed
			reason
			eventId
		}
	}
`;

/** A single audit event as returned by `auditHistory`. */
export interface ApiAuditEvent {
	id: string;
	actorUserId: string | null;
	source: string;
	action: string;
	targetType: string;
	targetId: string;
	occurredAt: string;
	reversibility: string;
	irreversibleReason: string | null;
	reversalOfEventId: string | null;
	before: string | null;
	after: string | null;
}

/** Fetch the audit history for a single work item. */
export async function loadAuditHistory(
	targetType: string,
	targetId: string,
): Promise<ApiAuditEvent[]> {
	const { auditHistory } = await graphqlRequest<{ auditHistory: ApiAuditEvent[] }>(
		AUDIT_HISTORY_QUERY,
		{ targetType, targetId },
	);
	return auditHistory;
}

/** Result of a revert operation. */
export interface RevertResult {
	allowed: boolean;
	reason: string | null;
	eventId: string | null;
}

/** Attempt to revert an audit event. */
export async function revertAuditEvent(eventId: string): Promise<RevertResult> {
	const { revertAuditEvent: result } = await graphqlRequest<{
		revertAuditEvent: RevertResult;
	}>(REVERT_MUTATION, { eventId });
	return result;
}
