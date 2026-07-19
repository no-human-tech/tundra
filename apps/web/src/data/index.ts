/**
 * Fixtures barrel — the single import surface for the web app's demo data.
 *
 * This layer is consumed by BOTH the global screens (Phase 2a) and the project
 * screens (Phase 2b). Keep additions here so screens never reach into individual
 * files inconsistently. All data is demo-only; the real app resolves it via the
 * GraphQL API / domain selectors.
 */

export * from "./people.js";
export * from "./projects.js";
export * from "./ProjectsContext.js";
export * from "./projectRoles.js";
export * from "./modules.js";
export * from "./workItems.js";
export * from "./stories.js";
export * from "./board.js";
export * from "./sprints.js";
export * from "./timesheet.js";
export * from "./teamReport.js";
export * from "./docs.js";
export * from "./comments.js";
export * from "./reports.js";
export * from "./dashboard.js";
