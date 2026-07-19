/**
 * Lazy database client factory.
 *
 * IMPORTANT: nothing here connects at import time. `createDbClient` constructs a
 * `pg` Pool and a Drizzle instance only when called, so importing this module
 * (e.g. in tests or tooling) never opens a socket or needs real credentials.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema/index.js";

/** The typed Drizzle client, with the core schema bound for relational queries. */
export type DbClient = NodePgDatabase<typeof schema>;

export interface DbHandle {
	db: DbClient;
	pool: Pool;
	/** Close the underlying connection pool. */
	close(): Promise<void>;
}

/**
 * Create a database client from a connection string. Call this once at app
 * startup (in `apps/api` / `apps/worker`), never at module import.
 */
export function createDbClient(databaseUrl: string): DbHandle {
	const pool = new Pool({ connectionString: databaseUrl });
	const db = drizzle(pool, { schema });
	return {
		db,
		pool,
		close: () => pool.end(),
	};
}
