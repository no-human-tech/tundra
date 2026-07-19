/**
 * Back-compat re-export shim.
 *
 * The demo fixtures were split into a clear `data/` layer (people, projects,
 * modules, workItems, stories, board, sprints, timesheet, docs, comments,
 * reports, dashboard) consumed by both the global screens (Phase 2a) and the
 * project screens (Phase 2b). This file preserves the original import path used
 * by existing tests and layouts. Prefer importing from `../data` (the barrel).
 */

export { sampleMyTasks } from "./workItems.js";
export { sampleProjects, findProject } from "./projects.js";
export type { SampleProject } from "./projects.js";
