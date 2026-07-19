/**
 * Apply pending SQL migrations to a database.
 *
 * Uses Drizzle's node-postgres migrator against the committed SQL under
 * `../drizzle`. The migrations folder is resolved relative to this module so it
 * works regardless of the process working directory.
 *
 * The whole run is serialized behind a Postgres session-level advisory lock so
 * concurrent callers (two API replicas starting at once, or a migration Job
 * racing a replica) never interleave: the second caller blocks until the first
 * finishes and then finds nothing left to apply.
 */

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { migrate } from "drizzle-orm/node-postgres/migrator";

import type { DbHandle } from "./client.js";

const moduleDir = dirname(fileURLToPath(import.meta.url));
/** Absolute path to the committed migrations folder (`packages/db/drizzle`). */
const migrationsFolder = resolve(moduleDir, "..", "drizzle");

/**
 * Advisory lock key for schema migrations. Arbitrary but stable — every Tundra
 * process that migrates this database must use the same value.
 */
const MIGRATION_LOCK_KEY = 7_412_001;

/**
 * Run all pending migrations on the given handle's database, bringing the schema
 * up to the latest committed migration.
 *
 * Safe to call concurrently from multiple processes: a session-level
 * `pg_advisory_lock` serializes the runs.
 *
 * @param handle An open database handle from `createDbClient`.
 */
export async function migrateToLatest(handle: DbHandle): Promise<void> {
	// The advisory lock is session-scoped, so it must be taken and released on
	// the SAME dedicated connection; the migrator itself may use others from the
	// pool — that is fine, the lock only serializes whole runs.
	const lockClient = await handle.pool.connect();
	try {
		await lockClient.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
		await migrate(handle.db, { migrationsFolder });
	} finally {
		try {
			await lockClient.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
		} finally {
			lockClient.release();
		}
	}
}
