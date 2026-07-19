import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import {
	Avatar,
	Badge,
	Button,
	Card,
	CardSection,
	Chip,
	EmptyState,
	ExtensionPointsRegistry,
	Icon,
	ModuleCard,
	Skeleton,
	Timer,
	Toggle,
	WorkItemList,
} from "@tundra/ui";

import {
	loadWorkspaceMembers,
	changeMemberRole,
	type ApiWorkspaceMember,
} from "../../api/queries.js";
import { useAuth } from "../../auth/AuthContext.js";

import { PageHeader } from "../../components/PageHeader.js";
import { useNewProjectModal } from "../../components/NewProjectModalContext.js";
import {
	DonutChart,
	FilterChip,
	MetricCard,
	Section,
	WeekBarChart,
} from "../../components/sections.js";
import { useLiveTimer } from "../../hooks/useLiveTimer.js";
import { formatDecimalHours } from "../../i18n/formatNumber.js";
import { workItemLabels } from "../../i18n/workItemLabels.js";
import {
	ALL_PEOPLE,
	ARCHITECTURE_LAYERS,
	DASHBOARD_METRICS,
	RECENT_COMMENTS,
	EXTENSION_POINTS,
	MODULE_ACTIVITY,
	MODULE_CATALOG,
	TEAM_REPORT_ROWS,
	TIMER_CONTEXT,
	TIMESHEET_ROWS,
	WEEK_DAYS,
	dashboardWorkQueue,
	dayTotal,
	formatDuration,
	moduleActivityToneColor,
	myTasksGroups,
	rowTotal,
	teamReportToCsv,
	useProjects,
	weekTotal,
	type MyTasksGroupName,
} from "../../data/index.js";

/** Stable keys for the architecture metaphor + dashboard metric + module-status i18n maps. */
const ARCH_KEY: Record<string, { label: string; sub: string }> = {
	"arch-core": { label: "architecture.core", sub: "architecture.coreSub" },
	"arch-modules": { label: "architecture.modules", sub: "architecture.modulesSub" },
	"arch-ext": { label: "architecture.ext", sub: "architecture.extSub" },
	"arch-int": { label: "architecture.integrations", sub: "architecture.integrationsSub" },
};

const METRIC_KEY: Record<string, { label: string; delta?: string; sub: string }> = {
	"m-projects": {
		label: "dashboard.metrics.activeProjects",
		sub: "dashboard.metrics.activeProjectsSub",
	},
	"m-tasks": {
		label: "dashboard.metrics.myOpenTasks",
		delta: "dashboard.metrics.myOpenTasksDelta",
		sub: "dashboard.metrics.myOpenTasksSub",
	},
	"m-sprint": {
		label: "dashboard.metrics.sprintHealth",
		delta: "dashboard.metrics.sprintHealthDelta",
		sub: "dashboard.metrics.sprintHealthSub",
	},
	"m-time": {
		label: "dashboard.metrics.loggedThisWeek",
		delta: "dashboard.metrics.loggedThisWeekDelta",
		sub: "dashboard.metrics.loggedThisWeekSub",
	},
};

/** Weekday short-label keys in WEEK_DAYS order (Mon..Sun). */
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * The dashboard "My open tasks" donut groups the same My Tasks queue buckets
 * (Today / Upcoming / Blocked / No due date), excluding "Done recently" since
 * the widget is about OPEN work. Key -> i18n key (reusing `myTasks.groups.*`)
 * and a distinct chart color per bucket.
 */
const OPEN_TASKS_GROUP_KEY: Record<MyTasksGroupName, string> = {
	Today: "today",
	Upcoming: "upcoming",
	Blocked: "blocked",
	"No due date": "noDueDate",
	"Done recently": "doneRecently",
};
const OPEN_TASKS_GROUP_COLOR: Record<MyTasksGroupName, string> = {
	Today: "var(--tnd-color-accent)",
	Upcoming: "var(--tnd-color-brand)",
	Blocked: "var(--tnd-color-danger)",
	"No due date": "var(--tnd-color-text-faint)",
	"Done recently": "var(--tnd-color-success)",
};

/** Cycled tint pairs for the "Active projects" key badges. */
const PROJECT_TINTS = [
	{ bg: "var(--tnd-color-mint-100)", fg: "var(--tnd-color-mint-600)" },
	{ bg: "var(--tnd-color-ext-soft)", fg: "var(--tnd-color-ext-on-soft)" },
	{ bg: "var(--tnd-color-info-soft)", fg: "var(--tnd-color-info-on-soft)" },
];

/** Extension-point id -> extensions.points.<key> i18n key. */
const EXT_POINT_KEY: Record<string, string> = {
	"ext-sidebar": "extensions.points.sidebar",
	"ext-tabs": "extensions.points.projectTabs",
	"ext-drawer": "extensions.points.taskDrawer",
	"ext-widgets": "extensions.points.dashboardWidgets",
	"ext-automation": "extensions.points.automationActions",
	"ext-reports": "extensions.points.reports",
};

/* ===================================================================== Dashboard */

export function DashboardPage() {
	const { t, i18n } = useTranslation();
	const { open: openNewProjectModal } = useNewProjectModal();
	const { projects } = useProjects();

	// LEFT col, card 2: top 3 active projects (matches the comp's
	// hint-placeholder-count of 3).
	const activeProjects = projects.filter((p) => p.status === "Active").slice(0, 3);

	// RIGHT col, card 1: the same My Tasks queue buckets as /my-tasks, minus
	// "Done recently" — this donut is specifically about OPEN work.
	const openTaskGroups = myTasksGroups.filter((g) => g.name !== "Done recently");
	const openTasksTotal = openTaskGroups.reduce((sum, g) => sum + g.entries.length, 0);
	const openTasksSegments = openTaskGroups.map((g) => ({
		label: t(`myTasks.groups.${OPEN_TASKS_GROUP_KEY[g.name]}` as never),
		count: g.entries.length,
		color: OPEN_TASKS_GROUP_COLOR[g.name],
	}));

	// RIGHT col, card 2: this week's logged hours per day, from the same
	// timesheet fixtures the /time screen's table uses.
	const weekBarValues = WEEK_DAYS.map((_, i) => ({
		day: t(`time.days.${WEEKDAY_KEYS[i]}` as never, { defaultValue: WEEK_DAYS[i] }),
		value: dayTotal(i),
	}));

	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("dashboard.kicker")}
				title={t("dashboard.title")}
				lead={t("dashboard.lead")}
				actions={
					<>
						<Link to="/extensions" className="tnd-button tnd-button--secondary">
							<Icon name="blocks" size={16} aria-hidden /> {t("dashboard.customizeModules")}
						</Link>
						<Button
							variant="accent"
							leadingIcon={<Icon name="plus" size={16} aria-hidden />}
							onClick={openNewProjectModal}
						>
							{t("dashboard.newProject")}
						</Button>
					</>
				}
			/>

			<Section title={t("dashboard.overview")}>
				<div className="tnd-grid tnd-grid--metrics">
					{DASHBOARD_METRICS.map((m) => {
						const keys = METRIC_KEY[m.id];
						// the design spec §7.5: "My open tasks" as a donut (share of
						// today's due load) and "Sprint health" as a ring (its own %).
						// Both are plain SVG `stroke-dasharray` rings — no chart library.
						const ring =
							m.id === "m-tasks"
								? Math.round(((m.deltaCount ?? 0) / Number(m.value || 1)) * 100)
								: m.id === "m-sprint"
									? Number(String(m.value).replace("%", ""))
									: undefined;
						return (
							<MetricCard
								key={m.id}
								label={keys ? t(keys.label as never) : m.label}
								value={m.value}
								delta={keys?.delta ? t(keys.delta as never, { count: m.deltaCount ?? 0 }) : m.delta}
								deltaAccent={m.deltaAccent}
								sub={keys ? t(keys.sub as never, { count: m.subCount ?? 0 }) : m.sub}
								icon={m.icon}
								ring={ring}
								ringTone={m.id === "m-tasks" ? "accent" : "brand"}
							/>
						);
					})}
				</div>
			</Section>

			{/* Two-column dashboard body — LEFT: work queue, active projects, module
			    activity. RIGHT: my open tasks (donut), time logged this week (bars),
			    recent comments. Order matches the canonical comp exactly; do not
			    reorder without checking the design prototype. */}
			<div className="tnd-split tnd-split--dashboard">
				<div>
					<Section
						title={t("dashboard.myWorkQueue")}
						hint={t("dashboard.oneQueueManySources")}
						actions={
							<Link to="/my-tasks" className="tnd-button tnd-button--ghost tnd-button--sm">
								{t("common.viewAll")} <Icon name="arrowRight" size={14} aria-hidden />
							</Link>
						}
					>
						<WorkItemList
							items={dashboardWorkQueue}
							aria-label={t("dashboard.myWorkQueue")}
							labels={workItemLabels(t)}
						/>
					</Section>

					<Section
						title={t("dashboard.activeProjects")}
						actions={
							<Link to="/projects" className="tnd-button tnd-button--ghost tnd-button--sm">
								{t("common.viewAll")}
							</Link>
						}
					>
						<Card>
							<ul className="tnd-list-reset" style={{ padding: "0 var(--tnd-space-5)" }}>
								{activeProjects.map((p, i) => {
									const tint = PROJECT_TINTS[i % PROJECT_TINTS.length]!;
									return (
										<li key={p.id} className="tnd-itemrow">
											<span
												className="tnd-dashproj__key"
												aria-hidden="true"
												style={{ background: tint.bg, color: tint.fg }}
											>
												{p.key}
											</span>
											<span className="tnd-itemrow__main">
												<span className="tnd-itemrow__title">{p.name}</span>
												<span className="tnd-itemrow__meta">
													{t("projects.meta", {
														open: p.openTasks,
														members: p.memberCount,
														owner: p.owner.shortName,
														updated: p.updated,
													})}
												</span>
											</span>
											<span className="tnd-dashproj__progress">
												<span className="tnd-meterbar">
													<span
														className="tnd-meterbar__fill"
														style={{ width: `${p.progress}%` }}
													/>
												</span>
												<span className="tnd-dashproj__percent">{p.progress}%</span>
											</span>
										</li>
									);
								})}
							</ul>
						</Card>
					</Section>

					<Section title={t("dashboard.moduleActivity")} hint={t("dashboard.last24Hours")}>
						<Card padded>
							<div className="tnd-modact-grid">
								{MODULE_ACTIVITY.map((a) => {
									const color = moduleActivityToneColor(a.tone);
									return (
										<div className="tnd-modact-tile" key={a.id}>
											<div className="tnd-modact-tile__head">
												<Icon name={a.icon} size={16} aria-hidden style={{ color }} />
												<span>{a.name}</span>
											</div>
											<div
												className="tnd-row"
												style={{ gap: "var(--tnd-space-1)", alignItems: "baseline" }}
											>
												<span className="tnd-modact-tile__count">{a.count}</span>
												<span className="tnd-modact-tile__unit">{a.unit}</span>
											</div>
											<div className="tnd-modact-tile__bar">
												<div
													className="tnd-modact-tile__bar-fill"
													style={{ width: `${a.pct}%`, background: color }}
												/>
											</div>
										</div>
									);
								})}
							</div>
						</Card>
					</Section>
				</div>

				<div>
					<Section
						title={t("dashboard.openTasksTitle")}
						hint={t("dashboard.tasksTotal", { count: openTasksTotal })}
						actions={
							<Link to="/my-tasks" className="tnd-button tnd-button--ghost tnd-button--sm">
								{t("common.viewAll")} <Icon name="arrowRight" size={14} aria-hidden />
							</Link>
						}
					>
						<Card padded>
							<div className="tnd-row" style={{ gap: "var(--tnd-space-5)", flexWrap: "nowrap" }}>
								<DonutChart
									segments={openTasksSegments}
									centerValue={openTasksTotal}
									centerLabel={t("dashboard.total")}
									ariaLabel={t("dashboard.tasksTotal", { count: openTasksTotal })}
								/>
								<div className="tnd-donut-legend">
									{openTasksSegments.map((s, i) => (
										<div className="tnd-donut-legend__row" key={i}>
											<span
												className="tnd-donut-legend__dot"
												style={{ background: s.color }}
												aria-hidden="true"
											/>
											<span className="tnd-donut-legend__label">{s.label}</span>
											<span className="tnd-donut-legend__count" style={{ color: s.color }}>
												{s.count}
											</span>
										</div>
									))}
								</div>
							</div>
						</Card>
					</Section>

					<Section
						title={t("dashboard.timeLoggedTitle")}
						actions={
							<Link to="/time" className="tnd-button tnd-button--ghost tnd-button--sm">
								{t("dashboard.openLink")}
							</Link>
						}
					>
						<Card padded>
							<WeekBarChart values={weekBarValues} ariaLabel={t("dashboard.timeLoggedTitle")} />
							<div
								className="tnd-row"
								style={{
									gap: "var(--tnd-space-2)",
									alignItems: "baseline",
									borderTop: "1px solid var(--tnd-color-border-soft)",
									paddingTop: "var(--tnd-space-3)",
								}}
							>
								<span
									style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--tnd-color-text)" }}
								>
									{t("dashboard.timeLoggedTotal", {
										hours: formatDecimalHours(weekTotal(), i18n.language),
									})}
								</span>
								<span className="tnd-subtle">{t("dashboard.loggedBillable")}</span>
							</div>
						</Card>
					</Section>

					<Section title={t("dashboard.recentComments")}>
						<Card>
							<ul className="tnd-list-reset" style={{ padding: "0 var(--tnd-space-5)" }}>
								{RECENT_COMMENTS.map((c) => (
									<li key={c.id} className="tnd-itemrow">
										<Avatar name={c.author.name} size="sm" />
										<span className="tnd-itemrow__main">
											<span className="tnd-itemrow__title">{c.title}</span>
											<span className="tnd-itemrow__meta">
												{c.author.shortName} · {t("dashboard.replies", { count: c.replies })} ·{" "}
												{c.lastActivity}
											</span>
										</span>
									</li>
								))}
							</ul>
						</Card>
					</Section>
				</div>
			</div>

			{/* Full-width, below the two-column layout — not part of the comp's
			    dashboard geometry, kept as a standalone section so it never disturbs
			    the strict LEFT/RIGHT card order above. */}
			<Section title={t("dashboard.howTundraFits")}>
				<Card padded>
					<ol className="tnd-list-reset tnd-stack">
						{ARCHITECTURE_LAYERS.map((layer) => {
							const keys = ARCH_KEY[layer.id];
							return (
								<li key={layer.id} className="tnd-row" style={{ gap: "var(--tnd-space-3)" }}>
									<span
										className="tnd-metriccard__icon"
										aria-hidden="true"
										style={{ width: "2rem", height: "2rem" }}
									>
										<Icon name={layer.icon} size={16} />
									</span>
									<span className="tnd-itemrow__main">
										<span className="tnd-itemrow__title">
											{keys ? t(keys.label as never) : layer.label}
										</span>
										<span className="tnd-itemrow__meta">
											{keys ? t(keys.sub as never) : layer.sub}
										</span>
									</span>
								</li>
							);
						})}
					</ol>
				</Card>
			</Section>
		</div>
	);
}

/* ====================================================================== Projects */

export function ProjectsPage() {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);
	const { projects } = useProjects();
	const { open: openNewProjectModal } = useNewProjectModal();

	const refresh = () => {
		setLoading(true);
		window.setTimeout(() => setLoading(false), 1200);
	};

	const STATUS_KEY: Record<string, string> = {
		Active: "projects.status.active",
		Paused: "projects.status.paused",
		Archived: "projects.status.archived",
	};

	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("projects.kicker")}
				title={t("projects.title")}
				lead={t("projects.lead")}
				actions={
					<>
						<Button
							variant="secondary"
							leadingIcon={<Icon name="time" size={16} />}
							onClick={refresh}
						>
							{t("projects.refresh")}
						</Button>
						<Button
							variant="accent"
							leadingIcon={<Icon name="plus" size={16} />}
							onClick={openNewProjectModal}
						>
							{t("projects.createProject")}
						</Button>
					</>
				}
			/>

			<div className="tnd-filterbar" aria-label={t("projects.filtersLabel")} role="group">
				<FilterChip label={t("projects.filters.status")} value={t("common.all")} />
				<FilterChip label={t("projects.filters.owner")} value={t("common.anyone")} />
				<FilterChip label={t("projects.filters.module")} value={t("common.any")} />
				<FilterChip label={t("projects.filters.updated")} value={t("common.recently")} />
			</div>

			<div className="tnd-grid tnd-grid--cards" aria-busy={loading}>
				{loading
					? Array.from({ length: 6 }).map((_, i) => (
							<div className="tnd-card tnd-card--padded tnd-stack" key={`sk-${i}`}>
								<Skeleton variant="text" width="55%" height={18} />
								<Skeleton variant="text" width="80%" />
								<Skeleton width="100%" height={8} radius={999} />
								<div className="tnd-row">
									<Skeleton variant="text" width={56} />
									<Skeleton variant="text" width={56} />
									<Skeleton variant="text" width={56} />
								</div>
							</div>
						))
					: projects.map((p) => (
							<Link
								key={p.id}
								to={`/projects/${p.id}/overview`}
								className="tnd-card tnd-card--padded tnd-card--interactive tnd-stack"
								style={{ color: "inherit", textDecoration: "none" }}
							>
								<div className="tnd-row tnd-row--between">
									<span className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
										<span className="tnd-projectctx__key" aria-hidden="true">
											{p.key}
										</span>
										<span className="tnd-itemrow__title" style={{ fontSize: "var(--tnd-text-md)" }}>
											{p.name}
										</span>
									</span>
									<Chip
										tone={
											p.status === "Active"
												? "success"
												: p.status === "Paused"
													? "warning"
													: "neutral"
										}
									>
										{t(STATUS_KEY[p.status] as never)}
									</Chip>
								</div>
								<p className="tnd-subtle" style={{ margin: 0 }}>
									{p.description}
								</p>
								<span className="tnd-meterbar">
									<span className="tnd-meterbar__fill" style={{ width: `${p.progress}%` }} />
								</span>
								<div className="tnd-itemrow__meta">
									{t("projects.meta", {
										open: p.openTasks,
										members: p.memberCount,
										owner: p.owner.shortName,
										updated: p.updated,
									})}
								</div>
								<div className="tnd-row" style={{ gap: "var(--tnd-space-1)" }}>
									{p.modules.slice(0, 5).map((m) => (
										<span key={m} className="tnd-projectctx__module-pill">
											{m}
										</span>
									))}
									{p.modules.length > 5 ? (
										<span className="tnd-projectctx__module-pill">+{p.modules.length - 5}</span>
									) : null}
								</div>
							</Link>
						))}
				{loading ? null : (
					<button
						type="button"
						className="tnd-projects__newtile"
						onClick={openNewProjectModal}
						aria-label={t("projects.newProjectTile.title")}
						title={t("projects.newProjectTile.hint")}
					>
						<span className="tnd-projects__newtile-icon" aria-hidden="true">
							<Icon name="plus" size={20} />
						</span>
						<span className="tnd-projects__newtile-title" aria-hidden="true">
							{t("projects.newProjectTile.title")}
						</span>
						<span className="tnd-projects__newtile-hint" aria-hidden="true">
							{t("projects.newProjectTile.hint")}
						</span>
					</button>
				)}
			</div>
		</div>
	);
}

/* ========================================================================== Time */

/**
 * Client-side CSV export for the team report (the design spec §7.10) — no
 * backend call, just a Blob download. Demo-only data (`TEAM_REPORT_ROWS`).
 */
function downloadTeamReportCsv() {
	const csv = teamReportToCsv(TEAM_REPORT_ROWS);
	const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "team-report.csv";
	link.click();
	URL.revokeObjectURL(url);
}

export function TimePage() {
	const { t, i18n } = useTranslation();
	const [running, setRunning] = useState(true);
	const elapsedSeconds = useLiveTimer(TIMER_CONTEXT.elapsedSeconds, running);

	return (
		<div className="tnd-page">
			<PageHeader kicker={t("time.kicker")} title={t("time.title")} lead={t("time.lead")} />

			<Section title={t("time.liveTimer")}>
				<Card padded>
					<Timer
						running={running}
						display={formatDuration(elapsedSeconds)}
						state={running ? t("time.tracking") : t("time.paused")}
						context={`${TIMER_CONTEXT.reference} · ${TIMER_CONTEXT.title}`}
						onToggle={() => setRunning((r) => !r)}
						startLabel={t("time.startTimer")}
						stopLabel={t("time.stopTimer")}
					/>
				</Card>
			</Section>

			<Section
				title={t("time.thisWeek")}
				hint={t("time.weekSummary", { logged: formatDecimalHours(weekTotal(), i18n.language) })}
			>
				<Card padded>
					<div className="tnd-table-scroll">
						<table className="tnd-timesheet">
							<thead>
								<tr>
									<th scope="col">{t("time.table.task")}</th>
									{WEEK_DAYS.map((d, i) => (
										<th scope="col" key={d}>
											{t(`time.days.${WEEKDAY_KEYS[i]}` as never, { defaultValue: d })}
										</th>
									))}
									<th scope="col">{t("time.table.total")}</th>
								</tr>
							</thead>
							<tbody>
								{TIMESHEET_ROWS.map((row) => (
									<tr key={row.id}>
										<td className="tnd-timesheet__task">
											{row.task}
											<div className="tnd-itemrow__meta">{row.projectName}</div>
										</td>
										{row.hours.map((h, i) => (
											<td key={i} className={h ? "" : "tnd-timesheet__empty"}>
												{h ? formatDecimalHours(h, i18n.language) : "·"}
											</td>
										))}
										<td>{formatDecimalHours(rowTotal(row), i18n.language)}</td>
									</tr>
								))}
							</tbody>
							<tfoot>
								<tr>
									<td>{t("time.table.dailyTotal")}</td>
									{WEEK_DAYS.map((_, i) => (
										<td key={i}>
											{dayTotal(i) ? formatDecimalHours(dayTotal(i), i18n.language) : "·"}
										</td>
									))}
									<td>{formatDecimalHours(weekTotal(), i18n.language)}</td>
								</tr>
							</tfoot>
						</table>
					</div>
				</Card>
			</Section>

			<Section
				title={t("time.teamReport.title")}
				hint={t("time.teamReport.hint")}
				actions={
					<Button
						variant="ghost"
						size="sm"
						leadingIcon={<Icon name="download" size={16} aria-hidden />}
						onClick={() => downloadTeamReportCsv()}
					>
						{t("time.teamReport.exportCsv")}
					</Button>
				}
			>
				<Card padded>
					<div className="tnd-table-scroll">
						<table className="tnd-teamreport">
							<thead>
								<tr>
									<th scope="col">{t("time.teamReport.table.person")}</th>
									<th scope="col">{t("time.teamReport.table.role")}</th>
									<th scope="col">{t("time.teamReport.table.total")}</th>
									<th scope="col">{t("time.teamReport.table.billable")}</th>
									<th scope="col">{t("time.teamReport.table.utilization")}</th>
								</tr>
							</thead>
							<tbody>
								{TEAM_REPORT_ROWS.map((row) => (
									<tr key={row.id}>
										<td className="tnd-teamreport__person">{row.person}</td>
										<td>{row.role}</td>
										<td>{formatDecimalHours(row.totalHours, i18n.language)}</td>
										<td>{formatDecimalHours(row.billableHours, i18n.language)}</td>
										<td>{row.utilizationPct}%</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</Section>
		</div>
	);
}

/* ======================================================================= Reports */

/**
 * The GLOBAL reports screen is a deliberate empty state (the design spec
 * §7.16/§8): reporting is a PROJECT-scoped concept (see `ProjectReportsPage` /
 * `preports`, which stays populated with velocity/throughput/time metrics).
 * This screen never renders report cards or charts — only the shared
 * `EmptyState` pattern (icon, description, CTA back into Projects).
 */
export function ReportsPage() {
	const { t } = useTranslation();
	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("reports.kicker")}
				title={t("reports.title")}
				lead={t("reports.lead")}
			/>

			<EmptyState
				icon={<Icon name="bars" size={22} />}
				title={t("reports.emptyTitle")}
				description={t("reports.emptyDescription")}
				action={
					<Link to="/projects" className="tnd-button tnd-button--accent">
						{t("reports.browseProjects")} <Icon name="arrowRight" size={14} aria-hidden />
					</Link>
				}
			/>
		</div>
	);
}

/* ==================================================================== Extensions */

export function ExtensionsPage() {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(MODULE_CATALOG.map((m) => [m.id, m.status === "Enabled"])),
	);

	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("extensions.kicker")}
				title={t("extensions.title")}
				lead={t("extensions.lead")}
			/>

			<Section
				title={t("extensions.modules")}
				hint={t("extensions.inCatalog", { count: MODULE_CATALOG.length })}
			>
				<div className="tnd-grid tnd-grid--modules">
					{MODULE_CATALOG.map((m) => (
						<ModuleCard
							key={m.id}
							name={m.name}
							meta={`${m.category} · v${m.version}`}
							description={m.description}
							status={m.status}
							statusLabel={t(`extensions.moduleStatus.${m.status}` as never)}
							enableLabel={t("common.enable")}
							disableLabel={t("common.disable")}
							icon={<Icon name={m.icon} size={20} />}
							enabled={enabled[m.id]}
							toggleDisabled={m.locked}
							onToggle={(next) => setEnabled((s) => ({ ...s, [m.id]: next }))}
							actions={
								<Button variant="ghost" size="sm">
									{m.status === "Disabled"
										? t("common.enable")
										: m.status === "Experimental"
											? t("common.tryIt")
											: t("common.configure")}
								</Button>
							}
						/>
					))}
				</div>
			</Section>

			<Section title={t("extensions.extensionPoints")}>
				<ExtensionPointsRegistry
					title={t("extensions.registryTitle")}
					kicker={t("extensions.extensionPoints")}
					description={t("extensions.registryDescription")}
					ariaLabel={t("extensions.extensionPoints")}
					countLabel={t("extensions.namedSlots", { count: EXTENSION_POINTS.length })}
					contributingLabel={(count) => t("extensions.contributing", { count })}
					slots={EXTENSION_POINTS.map((p) => ({
						id: p.id,
						name: EXT_POINT_KEY[p.id] ? t(EXT_POINT_KEY[p.id] as never) : p.name,
						slotId: p.slotId,
						description: p.description,
						contributing: p.contributing,
						icon: <Icon name={p.icon} size={18} />,
					}))}
				/>
			</Section>
		</div>
	);
}

/* ============================================================ Workspace Settings */

export function WorkspaceSettingsPage() {
	const { t } = useTranslation();
	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("workspaceSettings.kicker")}
				title={t("workspaceSettings.title")}
				lead={t("workspaceSettings.lead")}
			/>

			<div className="tnd-split">
				<div>
					<Section
						title={t("workspaceSettings.members")}
						hint={t("workspaceSettings.peopleCount", { count: ALL_PEOPLE.length })}
					>
						<Card>
							<ul className="tnd-list-reset" style={{ padding: "0 var(--tnd-space-5)" }}>
								{ALL_PEOPLE.map((person) => (
									<li key={person.id} className="tnd-itemrow">
										<Avatar name={person.name} />
										<span className="tnd-itemrow__main">
											<span className="tnd-itemrow__title">{person.name}</span>
											<span className="tnd-itemrow__meta">{person.role}</span>
										</span>
										<Badge tone={person.role === "Owner" ? "brand" : "neutral"}>
											{person.role}
										</Badge>
									</li>
								))}
							</ul>
						</Card>
					</Section>

					<Section title={t("workspaceSettings.globalDefaults")}>
						<Card>
							<CardSection>
								<SettingRow label={t("workspaceSettings.defaultMethod")} value="Scrum" />
								<SettingRow
									label={t("workspaceSettings.defaultPriority")}
									value={t("workItem.priority.medium")}
								/>
								<SettingRow
									label={t("workspaceSettings.weekStartsOn")}
									value={t("workspaceSettings.monday")}
								/>
							</CardSection>
						</Card>
					</Section>
				</div>

				<div>
					<Section title={t("workspaceSettings.billing")}>
						<Card padded className="tnd-stack">
							<Badge tone="brand">{t("workspaceSettings.teamPlan")}</Badge>
							<span className="tnd-metriccard__value" style={{ fontSize: "var(--tnd-text-xl)" }}>
								{t("workspaceSettings.perMonth")}
							</span>
							<p className="tnd-subtle" style={{ margin: 0 }}>
								{t("workspaceSettings.billingNote")}
							</p>
							<Button variant="secondary" size="sm">
								{t("workspaceSettings.manageBilling")}
							</Button>
						</Card>
					</Section>

					<Section title={t("workspaceSettings.integrations")}>
						<Card>
							<CardSection>
								<ToggleRow label="GitHub" sub={t("workspaceSettings.githubSub")} defaultOn />
								<ToggleRow
									label="Community Import"
									sub={t("workspaceSettings.communityImportSub")}
								/>
							</CardSection>
						</Card>
					</Section>

					<Section title={t("workspaceSettings.globalExtensionRegistry")}>
						<Card padded className="tnd-stack">
							<p className="tnd-subtle" style={{ margin: 0 }}>
								{t("workspaceSettings.registryNote", {
									points: EXTENSION_POINTS.length,
									modules: MODULE_CATALOG.length,
								})}
							</p>
							<Link to="/extensions" className="tnd-button tnd-button--secondary tnd-button--sm">
								{t("workspaceSettings.openExtensions")}{" "}
								<Icon name="arrowRight" size={14} aria-hidden />
							</Link>
						</Card>
					</Section>
				</div>
			</div>
		</div>
	);
}

function SettingRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="tnd-itemrow">
			<span className="tnd-itemrow__main">
				<span className="tnd-itemrow__title">{label}</span>
			</span>
			<span className="tnd-muted">{value}</span>
		</div>
	);
}

function ToggleRow({
	label,
	sub,
	defaultOn = false,
}: {
	label: string;
	sub: string;
	defaultOn?: boolean;
}) {
	const { t } = useTranslation();
	const [on, setOn] = useState(defaultOn);
	return (
		<div className="tnd-itemrow">
			<span className="tnd-itemrow__main">
				<span className="tnd-itemrow__title">{label}</span>
				<span className="tnd-itemrow__meta">{sub}</span>
			</span>
			<Toggle
				checked={on}
				label={t("workspaceSettings.toggleIntegration", { name: label })}
				onChange={setOn}
			/>
		</div>
	);
}

/* ============================================================ Workspace Members */

const DEFAULT_WORKSPACE_ID = "ws-tundra";

const ROLE_OPTIONS = ["admin", "member"] as const;
type WorkspaceRoleOption = (typeof ROLE_OPTIONS)[number];

/**
 * Admin panel for workspace membership. Fetches live member data via the
 * `workspaceMembers` GraphQL query and lets admins change roles. Changing the
 * last admin's role is blocked by the API.
 */
export function WorkspaceMembersPage() {
	const { t } = useTranslation();
	const { viewer } = useAuth();

	const [members, setMembers] = useState<ApiWorkspaceMember[] | null>(null);
	const [loading, setLoading] = useState(true);
	const [changingRole, setChangingRole] = useState<string | null>(null);
	const [flashError, setFlashError] = useState<string | null>(null);

	const isAdmin = viewer?.isWorkspaceAdmin ?? false;

	const fetchMembers = useCallback(() => {
		setLoading(true);
		loadWorkspaceMembers(DEFAULT_WORKSPACE_ID)
			.then(setMembers)
			.catch(() => setMembers([]))
			.finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		fetchMembers();
	}, [fetchMembers]);

	const handleRoleChange = async (userId: string, role: WorkspaceRoleOption) => {
		setChangingRole(userId);
		setFlashError(null);
		try {
			await changeMemberRole(DEFAULT_WORKSPACE_ID, userId, role);
			fetchMembers();
		} catch {
			setFlashError(t("admin.members.errorGeneric"));
		} finally {
			setChangingRole(null);
		}
	};

	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("admin.members.kicker")}
				title={t("admin.members.title")}
				lead={t("admin.members.lead")}
			/>

			{flashError ? (
				<p className="tnd-auth__error" role="alert" style={{ marginBottom: "var(--tnd-space-4)" }}>
					{flashError}
				</p>
			) : null}

			{loading ? (
				<Card padded aria-busy="true" aria-label={t("admin.members.loading")}>
					<div className="tnd-stack">
						{[0, 1, 2].map((i) => (
							<div key={i} className="tnd-itemrow">
								<Skeleton variant="circle" width={36} height={36} radius={999} />
								<span className="tnd-itemrow__main">
									<Skeleton variant="text" width={120} />
									<Skeleton variant="text" width={180} />
								</span>
								<Skeleton variant="text" width={60} />
							</div>
						))}
					</div>
				</Card>
			) : !members || members.length === 0 ? (
				<EmptyState
					icon={<Icon name="users" size={22} />}
					title={t("admin.members.emptyTitle")}
					description={t("admin.members.emptyDescription")}
				/>
			) : (
				<Card>
					<ul className="tnd-list-reset" style={{ padding: "0 var(--tnd-space-5)" }}>
						{members.map((m) => (
							<li key={m.userId} className="tnd-itemrow">
								<Avatar name={m.displayName} />
								<span className="tnd-itemrow__main">
									<span className="tnd-itemrow__title">{m.displayName}</span>
									<span className="tnd-itemrow__meta">{m.primaryEmail}</span>
								</span>
								{isAdmin ? (
									<select
										className="tnd-select"
										value={m.role === "owner" ? "admin" : m.role}
										disabled={changingRole === m.userId || m.role === "owner"}
										aria-label={t("admin.members.changeRoleLabel", { name: m.displayName })}
										onChange={(e) =>
											void handleRoleChange(m.userId, e.target.value as WorkspaceRoleOption)
										}
									>
										{ROLE_OPTIONS.map((r) => (
											<option key={r} value={r}>
												{t(`admin.members.role.${r}` as never)}
											</option>
										))}
									</select>
								) : (
									<Badge tone={m.role === "admin" || m.role === "owner" ? "brand" : "neutral"}>
										{t(`admin.members.role.${m.role === "owner" ? "owner" : m.role}` as never, {
											defaultValue: m.role,
										})}
									</Badge>
								)}
							</li>
						))}
					</ul>
				</Card>
			)}
		</div>
	);
}

/* ================================================================= Design system */

export { DesignSystemPage } from "./DesignSystemPage.js";

/* ===================================================================== Not found */

export function NotFoundPage() {
	const { t } = useTranslation();
	return (
		<div className="tnd-page">
			<PageHeader title={t("notFound.title")} lead={t("notFound.lead")} />
			<EmptyState
				icon={<Icon name="search" size={22} />}
				title={t("notFound.emptyTitle")}
				description={t("notFound.emptyDescription")}
				action={
					<Link to="/dashboard" className="tnd-button tnd-button--primary">
						{t("notFound.backToDashboard")}
					</Link>
				}
			/>
		</div>
	);
}
