/**
 * GraphQL schema + resolvers for the Tundra API.
 *
 * Backend-agnostic: every resolver reads and writes through the
 * {@link GraphQLContext}'s `dataSource` (db- or mock-backed) and authorizes
 * against its `principal`. Aggregation (`selectMyTasks`) and revert authorization
 * (`canRevertAction`) stay in `@tundra/domain` behind the data source; the
 * resolvers only shape inputs and outputs.
 *
 * The schema is built once with the `graphql` package's `buildSchema`, then Query
 * and Mutation field resolvers are attached onto the schema's field definitions.
 * Using one `graphql` instance for both the schema and the executor keeps GraphQL
 * Yoga and tests (`graphql({ schema })`) in a single schema realm — no cross-realm
 * identity errors. The schema is exported so tests can execute operations against
 * a fake context without binding an HTTP port (see `index.ts` for the server).
 */

import { GraphQLObjectType, buildSchema } from "graphql";
import { ExtensionPointKind, WorkItemSource } from "@tundra/domain";
import type {
	AuditEvent,
	ModuleManifest,
	UserId,
	WorkItemPriority,
	WorkItemStatus,
	WorkspaceRole,
} from "@tundra/domain";

import type { GraphQLContext } from "./context.js";

export const typeDefs = /* GraphQL */ `
	enum WorkItemSource {
		task
		story_checklist
		subtask
		bug
		review
		docs
		automation
		extension
	}

	enum WorkItemStatus {
		todo
		in_progress
		blocked
		done
		cancelled
	}

	enum WorkItemPriority {
		low
		medium
		high
		urgent
	}

	type WorkItemSourceRef {
		source: WorkItemSource!
		refId: String!
		moduleId: ID
	}

	type WorkItem {
		id: ID!
		projectId: ID!
		source: WorkItemSource!
		sourceRef: WorkItemSourceRef!
		title: String!
		status: WorkItemStatus!
		priority: WorkItemPriority!
		assigneeId: ID
		dueDate: String
		sprintId: ID
		createdAt: String!
		updatedAt: String!
	}

	type Project {
		id: ID!
		workspaceId: ID!
		name: String!
		key: String!
		slug: String!
		description: String
		enabledModuleIds: [ID!]!
		archivedAt: String
		createdAt: String!
		updatedAt: String!
	}

	type Module {
		id: ID!
		name: String!
		version: String!
		description: String!
		author: String!
		permissions: [String!]!
		providesWorkItemSources: [WorkItemSource!]!
	}

	"The resolved authorization context for the current request."
	type Viewer {
		userId: ID!
		displayName: String!
		workspaceId: ID
		workspaceRole: String
		permissions: [String!]!
		isWorkspaceAdmin: Boolean!
	}

	"One append-only entry in the audit trail. before/after/inverse are JSON strings."
	type AuditEvent {
		id: ID!
		actorUserId: ID
		source: String!
		action: String!
		targetType: String!
		targetId: ID!
		occurredAt: String!
		reversibility: String!
		irreversibleReason: String
		"Set on a compensating event; the id of the event it reverts."
		reversalOfEventId: ID
		before: String
		after: String
		inverse: String
	}

	type ChangeWorkItemStatusResult {
		workItem: WorkItem!
		eventId: ID!
	}

	type RevertResult {
		allowed: Boolean!
		reason: String
		"On success, the id of the compensating (revert) event."
		eventId: ID
	}

	"A workspace member as seen by the admin panel."
	type WorkspaceMember {
		userId: ID!
		displayName: String!
		primaryEmail: String!
		role: String!
		joinedAt: String!
	}

	type CreateWorkItemResult {
		workItem: WorkItem!
		eventId: ID!
	}

	type UpdateWorkItemResult {
		workItem: WorkItem!
		eventId: ID!
	}

	type ChangeRoleResult {
		eventId: ID!
	}

	type Query {
		health: String!
		"The current request's resolved authorization context."
		viewer: Viewer!
		"Unified My Tasks for an assignee (defaults to the viewer), across all sources."
		myTasks(assigneeId: ID): [WorkItem!]!
		projects: [Project!]!
		modules: [Module!]!
		"Append-only audit history for a target, oldest first."
		auditHistory(targetType: String!, targetId: ID!): [AuditEvent!]!
		"List workspace members. Requires audit:read permission (admin/owner/member)."
		workspaceMembers(workspaceId: ID!): [WorkspaceMember!]!
	}

	type Mutation {
		"Change a work item's status, recording a reversible append-only audit event."
		changeWorkItemStatus(workItemId: ID!, status: WorkItemStatus!): ChangeWorkItemStatusResult!
		"Revert a previously-recorded audit event by appending a compensating event."
		revertAuditEvent(eventId: ID!): RevertResult!
		"Create a new work item in a project."
		createWorkItem(
			projectId: ID!
			title: String!
			source: WorkItemSource!
			priority: WorkItemPriority!
			assigneeId: ID
			dueDate: String
		): CreateWorkItemResult!
		"Update mutable fields on a work item (title, priority, assigneeId, dueDate)."
		updateWorkItem(
			workItemId: ID!
			title: String
			priority: WorkItemPriority
			assigneeId: ID
			dueDate: String
		): UpdateWorkItemResult!
		"Change a workspace member's role. Requires audit:revert:any (admin/owner)."
		changeWorkspaceMemberRole(workspaceId: ID!, userId: ID!, role: String!): ChangeRoleResult!
	}
`;

/** GraphQL representation of an AuditEvent (json snapshots as nullable strings). */
interface AuditEventGql {
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
	inverse: string | null;
}

/** Encode an opaque snapshot payload as a JSON string, or null when absent. */
function encodeJson(value: unknown): string | null {
	return value === undefined ? null : JSON.stringify(value);
}

/** Project a domain AuditEvent into its GraphQL shape. */
function toAuditEventGql(event: AuditEvent): AuditEventGql {
	return {
		id: event.id,
		actorUserId: event.actorUserId ?? null,
		source: event.source,
		action: event.action,
		targetType: event.targetType,
		targetId: event.targetId,
		occurredAt: event.occurredAt,
		reversibility: event.reversibility,
		irreversibleReason: event.irreversibleReason ?? null,
		reversalOfEventId: event.reversalOfEventId ?? null,
		before: encodeJson(event.before),
		after: encodeJson(event.after),
		inverse: encodeJson(event.inverse),
	};
}

/**
 * Module manifests are static host metadata (not owned by the data source). This
 * mirrors the previous mock `modules` query so the GraphQL contract is unchanged.
 */
const moduleManifests: ModuleManifest[] = [
	{
		id: "mod-helpdesk" as ModuleManifest["id"],
		name: "Helpdesk",
		version: "1.0.0",
		description: "Surfaces helpdesk tickets as WorkItems via a provider.",
		author: "Tundra",
		permissions: ["workitem:read", "project:nav"],
		providesWorkItemSources: [WorkItemSource.Extension],
		contributes: [
			{ kind: ExtensionPointKind.NavEntry, surface: "frontend", slot: "project.nav" },
			{ kind: ExtensionPointKind.WorkItemProvider, surface: "backend", slot: "workitem.providers" },
		],
	},
];

interface ModuleGql {
	id: string;
	name: string;
	version: string;
	description: string;
	author: string;
	permissions: string[];
	providesWorkItemSources: string[];
}

function toModuleGql(m: ModuleManifest): ModuleGql {
	return {
		id: m.id,
		name: m.name,
		version: m.version,
		description: m.description,
		author: m.author,
		permissions: m.permissions,
		providesWorkItemSources: m.providesWorkItemSources ?? [],
	};
}

type Resolver = (
	source: unknown,
	args: Record<string, unknown>,
	context: GraphQLContext,
) => unknown;

/** Query field resolvers. Nested fields resolve via default property access. */
const queryResolvers: Record<string, Resolver> = {
	health: () => "ok",
	viewer: (_s, _a, ctx) => {
		// The dev-header fallback lets every OTHER resolver keep working without a
		// real login (local dev convenience, seeded demo data) — but `viewer` is
		// specifically how the frontend decides whether a session exists at all
		// (LoginPage redirects once it sees a viewer). Treating a dev-fallback
		// principal as "logged in" here would make `/login` unreachable behind a
		// live API, since the fallback always resolves to *someone*.
		if (ctx.sessionSource !== "cookie") {
			throw new Error("not_authenticated");
		}
		return ctx.dataSource.viewer(ctx.principal);
	},
	myTasks: (_s, args, ctx) => {
		const assigneeId = (args["assigneeId"] as string | null | undefined) ?? ctx.principal.userId;
		if (!assigneeId) {
			return [];
		}
		return ctx.dataSource.myTasks(assigneeId as UserId);
	},
	projects: (_s, _a, ctx) => ctx.dataSource.listProjects(),
	modules: () => moduleManifests.map(toModuleGql),
	auditHistory: async (_s, args, ctx) => {
		const events = await ctx.dataSource.auditHistory(
			args["targetType"] as string,
			args["targetId"] as string,
		);
		return events.map(toAuditEventGql);
	},
	workspaceMembers: async (_s, args, ctx) => {
		return ctx.dataSource.listWorkspaceMembers(args["workspaceId"] as string);
	},
};

/** Mutation field resolvers. */
const mutationResolvers: Record<string, Resolver> = {
	changeWorkItemStatus: async (_s, args, ctx) => {
		const result = await ctx.dataSource.changeWorkItemStatus(
			ctx.principal,
			args["workItemId"] as string,
			args["status"] as WorkItemStatus,
		);
		if ("error" in result) {
			throw new Error(`changeWorkItemStatus failed: ${result.error}`);
		}
		return { workItem: result.workItem, eventId: result.event.id };
	},
	revertAuditEvent: async (_s, args, ctx) => {
		const decision = await ctx.dataSource.revertAuditEvent(
			ctx.principal,
			args["eventId"] as string,
		);
		if (decision.allowed) {
			return { allowed: true, reason: null, eventId: decision.event?.id ?? null };
		}
		return { allowed: false, reason: decision.reason, eventId: null };
	},
	createWorkItem: async (_s, args, ctx) => {
		const result = await ctx.dataSource.createWorkItem(ctx.principal, {
			projectId: args["projectId"] as string,
			title: args["title"] as string,
			source: args["source"] as WorkItemSource,
			priority: args["priority"] as WorkItemPriority,
			assigneeId: args["assigneeId"] as string | undefined,
			dueDate: args["dueDate"] as string | undefined,
		});
		if ("error" in result) {
			throw new Error(`createWorkItem failed: ${result.error}`);
		}
		return result;
	},
	updateWorkItem: async (_s, args, ctx) => {
		const input: {
			title?: string;
			priority?: WorkItemPriority;
			assigneeId?: string | null;
			dueDate?: string | null;
		} = {};
		if (args["title"] !== undefined && args["title"] !== null) {
			input.title = args["title"] as string;
		}
		if (args["priority"] !== undefined && args["priority"] !== null) {
			input.priority = args["priority"] as WorkItemPriority;
		}
		if ("assigneeId" in args) {
			input.assigneeId = (args["assigneeId"] as string | null) ?? null;
		}
		if ("dueDate" in args) {
			input.dueDate = (args["dueDate"] as string | null) ?? null;
		}
		const result = await ctx.dataSource.updateWorkItem(
			ctx.principal,
			args["workItemId"] as string,
			input,
		);
		if ("error" in result) {
			throw new Error(`updateWorkItem failed: ${result.error}`);
		}
		return result;
	},
	changeWorkspaceMemberRole: async (_s, args, ctx) => {
		const result = await ctx.dataSource.changeWorkspaceMemberRole(
			ctx.principal,
			args["workspaceId"] as string,
			args["userId"] as string,
			args["role"] as WorkspaceRole,
		);
		if ("error" in result) {
			throw new Error(`changeWorkspaceMemberRole failed: ${result.error}`);
		}
		return result;
	},
};

/** Build the executable schema and attach Query + Mutation resolvers. */
function buildExecutableSchema() {
	const built = buildSchema(typeDefs);

	const attach = (
		type: GraphQLObjectType | null | undefined,
		resolvers: Record<string, Resolver>,
	): void => {
		if (!(type instanceof GraphQLObjectType)) {
			return;
		}
		for (const [name, field] of Object.entries(type.getFields())) {
			const resolver = resolvers[name];
			if (resolver) {
				field.resolve = (s, args, context: GraphQLContext) =>
					resolver(s, args as Record<string, unknown>, context);
			}
		}
	};

	attach(built.getQueryType(), queryResolvers);
	attach(built.getMutationType(), mutationResolvers);
	return built;
}

export const schema = buildExecutableSchema();
