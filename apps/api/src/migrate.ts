/**
 * Standalone migration entrypoint for deployments.
 *
 * Applies all pending migrations and exits — this is what the Kubernetes
 * migration Job runs before each rollout (`pnpm --filter @tundra/api run
 * migrate`), with `RUN_MIGRATIONS_ON_START=false` keeping the API replicas
 * themselves from migrating. `migrateToLatest` holds a Postgres advisory lock,
 * so a Job racing a replica (or a re-run Job) serializes safely.
 */

import { createDbClient, migrateToLatest } from "@tundra/db";
import { loadConfig } from "@tundra/config";

/** Run migrations against `DATABASE_URL` and exit non-zero on failure. */
export async function runMigrations(): Promise<void> {
	const config = loadConfig();
	const handle = createDbClient(config.postgres.databaseUrl);
	try {
		await migrateToLatest(handle);
		console.log("Tundra migrations: up to date");
	} finally {
		await handle.close();
	}
}

// Entry guard: only run when executed directly (not when imported by tests).
if (process.argv[1] && import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
	runMigrations().catch((err) => {
		console.error("Tundra migrations failed:", err);
		process.exitCode = 1;
	});
}
