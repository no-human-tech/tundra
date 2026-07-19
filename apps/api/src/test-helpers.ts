/**
 * Test helpers: execute GraphQL operations against the schema with an in-memory
 * (mock) context — NO database. Shared by the API test suites so the full
 * GraphQL surface, including the reversible-action PoC, runs in the default
 * `pnpm test`.
 */

import { graphql } from "graphql";
import type { ExecutionResult } from "graphql";

import { schema } from "./schema.js";
import type { GraphQLContext } from "./context.js";
import { createMockDataSource } from "./data-source/mock.js";
import type { DataSource } from "./data-source/types.js";
import { buildMockPrincipal } from "./session.js";

/** A shared mock data source plus a helper to run ops as a given user. */
export interface TestHarness {
	dataSource: DataSource;
	run(
		userId: string,
		source: string,
		variables?: Record<string, unknown>,
	): Promise<ExecutionResult>;
}

/**
 * Build a test harness over one mock data source so mutations in one operation
 * are visible to later queries (e.g. changeWorkItemStatus then auditHistory).
 */
export function createTestHarness(): TestHarness {
	const dataSource = createMockDataSource();

	const run = (
		userId: string,
		source: string,
		variables?: Record<string, unknown>,
	): Promise<ExecutionResult> => {
		const contextValue: GraphQLContext = {
			principal: buildMockPrincipal(userId),
			dataSource,
			// Test ops run "as" an already-authenticated user — equivalent to a
			// real validated session cookie, not the dev-header fallback.
			sessionSource: "cookie",
		};
		return graphql({
			schema,
			source,
			variableValues: variables,
			contextValue,
		});
	};

	return { dataSource, run };
}
