import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { WorkItemPriority } from "@tundra/domain";
import {
	Avatar,
	Badge,
	Button,
	Card,
	CardSection,
	Chip,
	EmptyState,
	Icon,
	KanbanCard,
	KanbanColumn,
	ModuleCard,
	Timer,
	type ChipTone,
	type IconName,
} from "@tundra/ui";
import type { TFunction } from "i18next";

import {
	ProjectPageHeader,
	ProjectScreen,
	ProjectSection,
	useProject,
	useProjectHref,
} from "../../components/ProjectScreen.js";
import { TaskDrawer } from "../../components/TaskDrawer.js";
import { useLiveTimer } from "../../hooks/useLiveTimer.js";
import { formatDecimalHours } from "../../i18n/formatNumber.js";
import { priorityShort } from "../../i18n/workItemLabels.js";
import {
	ACTIVE_SPRINT,
	ALL_PEOPLE,
	ARCHITECTURE_LAYERS,
	BOARD_CARDS,
	BOARD_COLUMN_ACCENT,
	DOCS_TREE,
	EMPTY_REPORT,
	MODULE_CATALOG,
	PROJECT_ACTIVITY,
	REPORTS,
	SAMPLE_DOC_PAGE,
	SPRINTS,
	TIMER_CONTEXT,
	TIMESHEET_ROWS,
	WEEK_DAYS,
	dayTotal,
	findBoardCard,
	formatDuration,
	rowTotal,
	weekTotal,
	type BoardCard,
	type BoardColumnName,
} from "../../data/index.js";

const PRIORITY_TONE: Record<WorkItemPriority, ChipTone> = {
	[WorkItemPriority.Low]: "neutral",
	[WorkItemPriority.Medium]: "info",
	[WorkItemPriority.High]: "warning",
	[WorkItemPriority.Urgent]: "danger",
};

const PRIORITY_LABEL: Record<WorkItemPriority, string> = {
	[WorkItemPriority.Low]: "Low",
	[WorkItemPriority.Medium]: "Med",
	[WorkItemPriority.High]: "High",
	[WorkItemPriority.Urgent]: "Urgent",
};

/** Translate a board column name (the English column key maps 1:1 to i18n). */
function columnLabel(t: TFunction, name: string): string {
	return t(`project.board.columns.${name}` as never, { defaultValue: name });
}

/** Architecture metaphor layer id -> architecture.* key suffixes. */
const ARCH_LAYER_KEY: Record<string, { label: string; sub: string }> = {
	"arch-core": { label: "core", sub: "coreSub" },
	"arch-modules": { label: "modules", sub: "modulesSub" },
	"arch-ext": { label: "ext", sub: "extSub" },
	"arch-int": { label: "integrations", sub: "integrationsSub" },
};

/** Sprint state -> project.sprints.state.<key> i18n key. */
const SPRINT_STATE_KEY: Record<string, string> = {
	active: "active",
	planned: "planned",
	completed: "completed",
};

/** Weekday short-label keys in WEEK_DAYS order (Mon..Sun). */
const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/* ===================================================================== Overview */

export function ProjectOverviewPage() {
	const { t } = useTranslation();
	const project = useProject();
	const href = useProjectHref();
	if (!project) return null;

	const members = ALL_PEOPLE.slice(
		0,
		project.memberCount > ALL_PEOPLE.length ? ALL_PEOPLE.length : 5,
	);
	const enabledModules = MODULE_CATALOG.filter((m) =>
		project.modules.includes(displayToCatalog(m.name)),
	);
	const addableModules = MODULE_CATALOG.filter(
		(m) => !project.modules.includes(displayToCatalog(m.name)),
	);
	const sprintPct = Math.round(
		(ACTIVE_SPRINT.completedPoints / ACTIVE_SPRINT.committedPoints) * 100,
	);

	return (
		<ProjectScreen>
			<ProjectPageHeader
				kicker={t("project.overview.kicker")}
				title={t("project.overview.title")}
				lead={project.description}
				actions={
					<Link to={href("board")} className="tnd-button tnd-button--primary">
						{t("project.overview.openBoard")} <Icon name="arrowRight" size={14} aria-hidden />
					</Link>
				}
			/>

			<div className="tnd-overview-grid">
				<div>
					<ProjectSection
						title={t("project.overview.health")}
						aria-label={t("project.overview.healthLabel")}
					>
						<div className="tnd-grid tnd-grid--metrics">
							<Card padded className="tnd-metriccard">
								<span className="tnd-metriccard__label">{t("project.overview.progress")}</span>
								<span className="tnd-metriccard__value">{project.progress}%</span>
								<span className="tnd-meterbar">
									<span className="tnd-meterbar__fill" style={{ width: `${project.progress}%` }} />
								</span>
							</Card>
							<Card padded className="tnd-metriccard">
								<span className="tnd-metriccard__label">{t("project.overview.openWorkItems")}</span>
								<span className="tnd-metriccard__value">{project.openTasks}</span>
								<span className="tnd-metriccard__sub">
									{t("project.overview.acrossModules", { count: project.modules.length })}
								</span>
							</Card>
							<Card padded className="tnd-metriccard">
								<span className="tnd-metriccard__label">{t("project.overview.sprintHealth")}</span>
								<span className="tnd-metriccard__value">{sprintPct}%</span>
								<span className="tnd-delta">
									{t("common.daysLeft", { count: ACTIVE_SPRINT.daysLeft })}
								</span>
							</Card>
						</div>
					</ProjectSection>

					<ProjectSection
						title={t("project.overview.currentSprint")}
						hint={`${ACTIVE_SPRINT.name} · ${ACTIVE_SPRINT.range}`}
						actions={
							<Link to={href("sprints")} className="tnd-button tnd-button--ghost tnd-button--sm">
								{t("project.overview.sprintsLink")} <Icon name="arrowRight" size={14} aria-hidden />
							</Link>
						}
					>
						<Card padded className="tnd-sprint-card">
							<p className="tnd-muted" style={{ margin: 0 }}>
								{ACTIVE_SPRINT.goal}
							</p>
							<div className="tnd-sprint-card__bar">
								<span className="tnd-subtle">
									{t("common.ptsComplete", {
										completed: ACTIVE_SPRINT.completedPoints,
										committed: ACTIVE_SPRINT.committedPoints,
									})}
								</span>
								<Badge tone="success" uppercase>
									{t("project.overview.onTrack")}
								</Badge>
							</div>
							<span className="tnd-meterbar">
								<span className="tnd-meterbar__fill" style={{ width: `${sprintPct}%` }} />
							</span>
						</Card>
					</ProjectSection>

					<ProjectSection
						title={t("project.overview.modulesEnabled")}
						aria-label={t("project.overview.modulesLabel")}
					>
						<div className="tnd-grid tnd-grid--modules">
							{enabledModules.map((m) => (
								<ModuleCard
									key={m.id}
									name={m.name}
									meta={`${m.category} · v${m.version}`}
									description={m.description}
									status={m.locked ? "Installed" : "Enabled"}
									statusLabel={t(
										`extensions.moduleStatus.${m.locked ? "Installed" : "Enabled"}` as never,
									)}
									icon={<Icon name={m.icon} size={20} />}
									actions={
										<Link
											to={href("settings")}
											className="tnd-button tnd-button--ghost tnd-button--sm"
										>
											{t("common.configure")}
										</Link>
									}
								/>
							))}
						</div>
						{addableModules.length > 0 ? (
							<p className="tnd-subtle" style={{ marginTop: "var(--tnd-space-3)" }}>
								{t("project.overview.addable")}{" "}
								{addableModules.map((m, i) => (
									<span key={m.id}>
										<Link to={href("settings")} className="tnd-projectctx__module-pill">
											+ {m.name}
										</Link>
										{i < addableModules.length - 1 ? " " : ""}
									</span>
								))}
							</p>
						) : null}
					</ProjectSection>
				</div>

				<div>
					<ProjectSection
						title={t("project.overview.members")}
						hint={`${project.memberCount}`}
						aria-label={t("project.overview.members")}
					>
						<Card>
							<ul className="tnd-list-reset" style={{ padding: "0 var(--tnd-space-5)" }}>
								{members.map((p) => (
									<li key={p.id} className="tnd-itemrow">
										<Avatar name={p.name} size="sm" />
										<span className="tnd-itemrow__main">
											<span className="tnd-itemrow__title">{p.name}</span>
											<span className="tnd-itemrow__meta">{p.role}</span>
										</span>
										{p.id === project.owner.id ? (
											<Badge tone="brand">{t("project.overview.owner")}</Badge>
										) : null}
									</li>
								))}
							</ul>
						</Card>
					</ProjectSection>

					<ProjectSection
						title={t("project.overview.recentActivity")}
						aria-label={t("project.overview.recentActivity")}
					>
						<Card>
							<ul className="tnd-list-reset" style={{ padding: "0 var(--tnd-space-5)" }}>
								{PROJECT_ACTIVITY.map((a) => (
									<li key={a.id} className="tnd-itemrow">
										<Avatar name={a.who} size="sm" />
										<span className="tnd-itemrow__main">
											<span className="tnd-itemrow__title" style={{ fontWeight: 400 }}>
												<strong>{a.who}</strong> {a.action} {a.target}
											</span>
										</span>
										<span className="tnd-mono tnd-itemrow__meta">{a.when}</span>
									</li>
								))}
							</ul>
						</Card>
					</ProjectSection>

					<ProjectSection
						title={t("project.overview.howFits")}
						aria-label={t("project.overview.architectureLabel")}
					>
						<Card padded>
							<div className="tnd-arch">
								{ARCHITECTURE_LAYERS.map((layer, i) => (
									<div key={layer.id}>
										<div className="tnd-arch__layer" data-depth={i}>
											<span className="tnd-arch__icon" aria-hidden="true">
												<Icon name={layer.icon} size={16} />
											</span>
											<span className="tnd-itemrow__main">
												<span className="tnd-itemrow__title">
													{t(`architecture.${ARCH_LAYER_KEY[layer.id]?.label}` as never, {
														defaultValue: layer.label,
													})}
												</span>
												<span className="tnd-itemrow__meta">
													{t(`architecture.${ARCH_LAYER_KEY[layer.id]?.sub}` as never, {
														defaultValue: layer.sub,
													})}
												</span>
											</span>
										</div>
										{i < ARCHITECTURE_LAYERS.length - 1 ? (
											<span className="tnd-arch__connector" aria-hidden="true" />
										) : null}
									</div>
								))}
							</div>
						</Card>
					</ProjectSection>
				</div>
			</div>
		</ProjectScreen>
	);
}

/** Map a catalog display name to the short module name stored on projects. */
function displayToCatalog(name: string): string {
	const map: Record<string, string> = {
		"Tasks Core": "Tasks",
		"Kanban Board": "Board",
		Backlog: "Backlog",
		Sprints: "Sprints",
		"Time Tracking": "Time",
		Docs: "Docs",
		Reports: "Reports",
		Roadmap: "Roadmap",
		"GitHub Integration": "Integrations",
		"Community Import": "Integrations",
		Automations: "Automations",
		"Custom Module SDK": "SDK",
	};
	return map[name] ?? name;
}

/* ===================================================================== Backlog */

type BacklogGroupMode = "status" | "epic";

const BACKLOG_EPIC: Record<string, string> = {
	AUR: "Core & SDK",
};

export function ProjectBacklogPage() {
	const { t } = useTranslation();
	const project = useProject();
	const [mode, setMode] = useState<BacklogGroupMode>("status");
	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

	const groups =
		mode === "status"
			? groupBy(BOARD_CARDS, (c) => c.column)
			: groupBy(BOARD_CARDS, (c) => epicFor(c));

	const selected = selectedId ? findBoardCard(selectedId) : undefined;

	if (!project) return null;

	/** Translate a backlog group label depending on the active grouping mode. */
	const groupLabel = (name: string): string =>
		mode === "status"
			? columnLabel(t, name)
			: name === "Core & SDK"
				? t("project.backlog.epicCoreSdk")
				: name === "General"
					? t("project.backlog.epicGeneral")
					: name;

	return (
		<ProjectScreen>
			<ProjectPageHeader
				title={t("project.backlog.title")}
				actions={
					<Button variant="accent" leadingIcon={<Icon name="plus" size={16} />}>
						{t("project.backlog.newWorkItem")}
					</Button>
				}
			/>

			<div className="tnd-board-toolbar">
				<div
					className="tnd-board-toolbar__group"
					role="group"
					aria-label={t("project.backlog.groupByLabel")}
				>
					<button
						type="button"
						className="tnd-segmented"
						aria-pressed={mode === "status"}
						onClick={() => setMode("status")}
					>
						{t("project.backlog.groupByStatus")}
					</button>
					<button
						type="button"
						className="tnd-segmented"
						aria-pressed={mode === "epic"}
						onClick={() => setMode("epic")}
					>
						{t("project.backlog.groupByEpic")}
					</button>
				</div>
				<span className="tnd-subtle">
					{t("project.backlog.summary", {
						items: BOARD_CARDS.length,
						points: BOARD_CARDS.reduce((a, c) => a + (c.points ?? 0), 0),
					})}
				</span>
			</div>

			<div className="tnd-backlog">
				{groups.map(([name, cards]) => {
					const pts = cards.reduce((a, c) => a + (c.points ?? 0), 0);
					const label = groupLabel(name);
					return (
						<section key={name} className="tnd-backlog__group" aria-label={label}>
							<div className="tnd-backlog__group-head">
								<span className="tnd-backlog__group-name">{label}</span>
								<span className="tnd-backlog__group-count">{cards.length}</span>
								<span className="tnd-backlog__group-pts">
									{t("project.backlog.groupPts", { count: pts })}
								</span>
							</div>
							<ul className="tnd-backlog__list">
								{cards.map((c) => (
									<li key={c.id}>
										<button
											type="button"
											className="tnd-backlog__row"
											data-blocked={c.blocked ? "true" : undefined}
											onClick={() => setSelectedId(c.id)}
										>
											<span className="tnd-backlog__ref">{c.reference}</span>
											<span className="tnd-backlog__title">{c.title}</span>
											{c.blocked ? (
												<Badge tone="accent" uppercase>
													{t("common.blocked")}
												</Badge>
											) : null}
											{c.priority ? (
												<Chip tone={PRIORITY_TONE[c.priority]}>{priorityShort(t, c.priority)}</Chip>
											) : null}
											<span className="tnd-backlog__labels">
												{c.boardLabels.map((l) => (
													<span key={l.name} className="tnd-label-pill">
														{l.name}
													</span>
												))}
											</span>
											{c.assigneeName ? <Avatar name={c.assigneeName} size="sm" /> : null}
											<span className="tnd-backlog__pts">
												{typeof c.points === "number"
													? t("common.points", { count: c.points })
													: "—"}
											</span>
										</button>
									</li>
								))}
							</ul>
						</section>
					);
				})}
			</div>

			<TaskDrawer
				card={selected}
				columnName={selected ? columnLabel(t, selected.column) : undefined}
				projectName={project.name}
				onClose={() => setSelectedId(undefined)}
			/>
		</ProjectScreen>
	);
}

function epicFor(card: BoardCard): string {
	const key = card.reference?.split("-")[0] ?? "";
	return BACKLOG_EPIC[key] ?? "General";
}

/* ======================================================================= Board */

type BoardGrouping = "none" | "assignee" | "priority" | "phase";

/**
 * Presentation-layer mapping of board column → workflow phase.
 * Phase labels are stable English keys used for grouping; translated at render.
 */
const PHASE_FOR_COLUMN: Record<BoardColumnName, string> = {
	Backlog: "Planning",
	Ready: "Planning",
	"In Progress": "Execution",
	Review: "Execution",
	Done: "Deployment",
};

/** Stable ordering for phase swimlanes. */
const PHASE_ORDER = ["Planning", "Execution", "Deployment"] as const;

export function ProjectBoardPage() {
	const { t } = useTranslation();
	const project = useProject();
	const [grouping, setGrouping] = useState<BoardGrouping>("none");
	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

	// Swimlanes group ALL cards by lane; each lane renders the full column set.
	// Lane keys stay stable (English) for grouping; they are translated at render.
	const lanes = useMemo<[string, BoardCard[]][]>(() => {
		if (grouping === "none") return [["All work", BOARD_CARDS]];
		if (grouping === "assignee") {
			return groupBy(BOARD_CARDS, (c) => c.assigneeName ?? "Unassigned");
		}
		if (grouping === "phase") {
			// Enforce stable phase order regardless of card order in the fixture.
			const byPhase = new Map<string, BoardCard[]>(PHASE_ORDER.map((p) => [p, []]));
			for (const card of BOARD_CARDS) {
				const phase = PHASE_FOR_COLUMN[card.column];
				byPhase.get(phase)?.push(card);
			}
			return [...byPhase.entries()];
		}
		return groupBy(BOARD_CARDS, (c) => (c.priority ? PRIORITY_LABEL[c.priority] : "No priority"));
	}, [grouping]);

	if (!project) return null;

	const selected = selectedId ? findBoardCard(selectedId) : undefined;
	const columnNames = Object.keys(BOARD_COLUMN_ACCENT) as BoardColumnName[];

	/** Translate a swimlane key (assignee name passes through; reserved keys map). */
	const laneLabel = (key: string): string => {
		if (key === "All work") return t("project.board.allWork");
		if (key === "Unassigned") return t("project.board.unassigned");
		if (key === "No priority") return t("project.board.noPriority");
		if (key === "Planning") return t("project.board.planning");
		if (key === "Execution") return t("project.board.execution");
		if (key === "Deployment") return t("project.board.deployment");
		// Priority lane keys are the English short labels; translate via the enum.
		const priorityEntry = (Object.entries(PRIORITY_LABEL) as [WorkItemPriority, string][]).find(
			([, label]) => label === key,
		);
		if (priorityEntry) return priorityShort(t, priorityEntry[0]);
		return key;
	};

	const renderColumns = (cards: BoardCard[]) => (
		<div className="tnd-board">
			{columnNames.map((name) => {
				const colCards = cards.filter((c) => c.column === name);
				return (
					<KanbanColumn
						key={name}
						name={columnLabel(t, name)}
						count={colCards.length}
						accentColor={BOARD_COLUMN_ACCENT[name]}
					>
						{colCards.map((c) => (
							<KanbanCard
								key={c.id}
								card={{
									...c,
									labels: (
										<span className="tnd-kanban-card__labels">
											{c.boardLabels.map((l) => (
												<span key={l.name} className="tnd-label-pill">
													{l.name}
												</span>
											))}
											{typeof c.comments === "number" && c.comments > 0 ? (
												<span className="tnd-label-pill">
													<Icon name="message" size={11} aria-hidden /> {c.comments}
												</span>
											) : null}
										</span>
									),
								}}
								onOpen={setSelectedId}
								priorityLabel={(p) => priorityShort(t, p)}
								blockedLabel={t("common.blocked")}
								pointsLabel={(points) => t("common.points", { count: points })}
							/>
						))}
					</KanbanColumn>
				);
			})}
		</div>
	);

	return (
		<ProjectScreen>
			<ProjectPageHeader title={t("project.board.title")} titleHidden />

			<div className="tnd-board-toolbar">
				<div
					className="tnd-board-toolbar__group"
					role="group"
					aria-label={t("project.board.swimlaneLabel")}
				>
					<button
						type="button"
						className="tnd-segmented"
						aria-pressed={grouping === "none"}
						onClick={() => setGrouping("none")}
					>
						{t("project.board.noSwimlanes")}
					</button>
					<button
						type="button"
						className="tnd-segmented"
						aria-pressed={grouping === "assignee"}
						onClick={() => setGrouping("assignee")}
					>
						{t("project.board.byAssignee")}
					</button>
					<button
						type="button"
						className="tnd-segmented"
						aria-pressed={grouping === "priority"}
						onClick={() => setGrouping("priority")}
					>
						{t("project.board.byPriority")}
					</button>
					<button
						type="button"
						className="tnd-segmented"
						aria-pressed={grouping === "phase"}
						onClick={() => setGrouping("phase")}
					>
						{t("project.board.byPhase")}
					</button>
				</div>
				<span className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
					<Chip tone="success">{t("common.healthy")}</Chip>
					<Chip tone="accent">{t("common.blockedOrUrgent")}</Chip>
				</span>
			</div>

			{grouping === "none"
				? renderColumns(BOARD_CARDS)
				: lanes.map(([laneName, laneCards]) => {
						const label = laneLabel(laneName);
						return (
							<section
								key={laneName}
								className="tnd-swimlane"
								aria-label={t("project.board.swimlanePrefix", { name: label })}
							>
								<div className="tnd-swimlane__head">
									<span className="tnd-swimlane__name">{label}</span>
									<span className="tnd-swimlane__count">{laneCards.length}</span>
								</div>
								{renderColumns(laneCards)}
							</section>
						);
					})}

			<TaskDrawer
				card={selected}
				columnName={selected ? columnLabel(t, selected.column) : undefined}
				projectName={project.name}
				onClose={() => setSelectedId(undefined)}
			/>
		</ProjectScreen>
	);
}

/* ===================================================================== Sprints */

const SPRINT_STATE_TONE: Record<string, ChipTone> = {
	active: "success",
	planned: "info",
	completed: "neutral",
};

export function ProjectSprintsPage() {
	const { t } = useTranslation();
	const project = useProject();
	if (!project) return null;

	const velocity = SPRINTS.filter((s) => s.state === "completed").map((s) => s.completedPoints);
	const avgVelocity = velocity.length
		? Math.round(velocity.reduce((a, b) => a + b, 0) / velocity.length)
		: 0;
	const activeCards = BOARD_CARDS.filter((c) => c.column !== "Done");

	return (
		<ProjectScreen>
			<ProjectPageHeader title={t("project.sprints.title")} />

			<ProjectSection
				title={t("project.sprints.capacityVelocity")}
				aria-label={t("project.sprints.capacityVelocity")}
			>
				<div className="tnd-grid tnd-grid--metrics">
					<Card padded className="tnd-metriccard">
						<span className="tnd-metriccard__label">{t("project.sprints.activeSprint")}</span>
						<span className="tnd-metriccard__value">{ACTIVE_SPRINT.name}</span>
						<span className="tnd-metriccard__sub">{ACTIVE_SPRINT.range}</span>
					</Card>
					<Card padded className="tnd-metriccard">
						<span className="tnd-metriccard__label">{t("project.sprints.committed")}</span>
						<span className="tnd-metriccard__value tnd-mono">{ACTIVE_SPRINT.committedPoints}</span>
						<span className="tnd-metriccard__sub">{t("project.sprints.pointsThisSprint")}</span>
					</Card>
					<Card padded className="tnd-metriccard">
						<span className="tnd-metriccard__label">{t("project.sprints.averageVelocity")}</span>
						<span className="tnd-metriccard__value tnd-mono">{avgVelocity}</span>
						<span className="tnd-metriccard__sub">{t("project.sprints.ptsPerSprint")}</span>
					</Card>
				</div>
			</ProjectSection>

			<ProjectSection
				title={t("project.sprints.title")}
				hint={t("project.sprints.totalCount", { count: SPRINTS.length })}
				aria-label={t("project.sprints.sprintList")}
			>
				<div className="tnd-grid tnd-grid--two">
					{SPRINTS.map((s) => {
						const pct = Math.round((s.completedPoints / s.committedPoints) * 100);
						return (
							<Card key={s.id} padded className="tnd-sprint-card">
								<div className="tnd-row tnd-row--between">
									<span className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
										<span className="tnd-itemrow__title" style={{ fontSize: "var(--tnd-text-md)" }}>
											{s.name}
										</span>
										<Chip tone={SPRINT_STATE_TONE[s.state]}>
											{t(`project.sprints.state.${SPRINT_STATE_KEY[s.state] ?? s.state}` as never, {
												defaultValue: s.state,
											})}
										</Chip>
									</span>
									{s.daysLeft != null ? (
										<span className="tnd-mono tnd-subtle">
											{t("common.daysLeft", { count: s.daysLeft })}
										</span>
									) : (
										<span className="tnd-mono tnd-subtle">{s.range}</span>
									)}
								</div>
								<p className="tnd-muted" style={{ margin: 0 }}>
									{s.goal}
								</p>
								<div className="tnd-sprint-card__bar">
									<span className="tnd-subtle">
										{t("common.ptsOf", {
											completed: s.completedPoints,
											committed: s.committedPoints,
										})}
									</span>
									<span className="tnd-mono tnd-subtle">{pct}%</span>
								</div>
								<span className="tnd-meterbar">
									<span className="tnd-meterbar__fill" style={{ width: `${pct}%` }} />
								</span>
							</Card>
						);
					})}
				</div>
			</ProjectSection>

			<ProjectSection
				title={t("project.sprints.activeContents")}
				hint={t("project.sprints.openItems", { count: activeCards.length })}
				aria-label={t("project.sprints.activeContents")}
			>
				<Card>
					<ul className="tnd-list-reset" style={{ padding: "0 var(--tnd-space-5)" }}>
						{activeCards.map((c) => (
							<li key={c.id} className="tnd-itemrow">
								<span className="tnd-backlog__ref">{c.reference}</span>
								<span className="tnd-itemrow__main">
									<span className="tnd-itemrow__title">{c.title}</span>
									<span className="tnd-itemrow__meta">{columnLabel(t, c.column)}</span>
								</span>
								{c.assigneeName ? <Avatar name={c.assigneeName} size="sm" /> : null}
								<span className="tnd-mono tnd-subtle">
									{t("common.points", { count: c.points })}
								</span>
							</li>
						))}
					</ul>
				</Card>
			</ProjectSection>
		</ProjectScreen>
	);
}

/* ======================================================================== Time */

export function ProjectTimePage() {
	const { t, i18n } = useTranslation();
	const project = useProject();
	const [running, setRunning] = useState(true);
	const elapsedSeconds = useLiveTimer(TIMER_CONTEXT.elapsedSeconds, running);
	if (!project) return null;

	// PROJECT-scoped: only this project's timesheet rows (never the global view).
	const rows = TIMESHEET_ROWS.filter((r) => r.projectName === project.name);
	const projectRowTotal = (i: number) => rows.reduce((a, r) => a + (r.hours[i] ?? 0), 0);
	const projectWeekTotal = rows.reduce((a, r) => a + rowTotal(r), 0);

	return (
		<ProjectScreen>
			<ProjectPageHeader title={t("project.time.title")} />

			<ProjectSection title={t("project.time.liveTimer")} aria-label={t("project.time.liveTimer")}>
				<Card padded>
					<Timer
						running={running}
						display={formatDuration(elapsedSeconds)}
						state={running ? t("time.tracking") : t("time.paused")}
						context={`${TIMER_CONTEXT.reference} · ${TIMER_CONTEXT.title} · ${project.name}`}
						onToggle={() => setRunning((r) => !r)}
						startLabel={t("time.startTimer")}
						stopLabel={t("time.stopTimer")}
					/>
				</Card>
			</ProjectSection>

			<ProjectSection
				title={t("project.time.thisWeek")}
				hint={
					rows.length
						? t("project.time.hoursOnProject", {
								hours: formatDecimalHours(projectWeekTotal, i18n.language),
								project: project.name,
							})
						: t("project.time.hoursWorkspaceWide", {
								hours: formatDecimalHours(weekTotal(), i18n.language),
							})
				}
				aria-label={t("project.time.weeklyTimesheet")}
			>
				{rows.length === 0 ? (
					<Card padded>
						<EmptyState
							icon={<Icon name="clock" size={22} />}
							title={t("project.time.emptyTitle")}
							description={t("project.time.emptyDescription")}
							action={
								<Button variant="accent" leadingIcon={<Icon name="play" size={16} />}>
									{t("project.time.startTracking")}
								</Button>
							}
						/>
					</Card>
				) : (
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
									{rows.map((row) => (
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
												{projectRowTotal(i)
													? formatDecimalHours(projectRowTotal(i), i18n.language)
													: "·"}
											</td>
										))}
										<td>{formatDecimalHours(projectWeekTotal, i18n.language)}</td>
									</tr>
								</tfoot>
							</table>
						</div>
					</Card>
				)}
				<p className="tnd-subtle" style={{ marginTop: "var(--tnd-space-2)" }}>
					{t("project.time.workspaceSummary", {
						week: formatDecimalHours(weekTotal(), i18n.language),
						today: formatDecimalHours(dayTotal(0), i18n.language),
					})}
				</p>
			</ProjectSection>
		</ProjectScreen>
	);
}

/* ======================================================================= Wiki */

export function ProjectDocsPage() {
	const { t } = useTranslation();
	const project = useProject();
	const href = useProjectHref();
	const [activeDoc, setActiveDoc] = useState(
		DOCS_TREE.find((d) => d.active)?.id ?? DOCS_TREE[0]?.id ?? "",
	);
	if (!project) return null;

	const page = SAMPLE_DOC_PAGE;

	return (
		<ProjectScreen>
			<ProjectPageHeader
				title={t("project.docs.title")}
				titleHidden
				actions={
					<Button variant="accent" leadingIcon={<Icon name="plus" size={16} />}>
						{t("project.docs.newPage")}
					</Button>
				}
			/>

			<div className="tnd-doc-layout">
				<nav aria-label={t("project.docs.pagesLabel")}>
					<Card padded>
						<ul className="tnd-doc-tree">
							{DOCS_TREE.map((node) => {
								const current = node.id === activeDoc;
								return (
									<li key={node.id}>
										<button
											type="button"
											className="tnd-doc-tree__item"
											data-depth={node.depth}
											aria-current={current ? "true" : undefined}
											onClick={() => setActiveDoc(node.id)}
										>
											{node.title}
										</button>
									</li>
								);
							})}
						</ul>
					</Card>
				</nav>

				<Card padded>
					<article className="tnd-doc-prose">
						<h3 className="tnd-projhead__title">{page.title}</h3>
						<p className="tnd-subtle">
							{t("project.docs.updatedBy", { date: page.updated, author: page.author })}
						</p>
						{page.blocks.map((block, i) =>
							block.type === "heading" ? (
								<h2 key={i}>{block.text}</h2>
							) : block.type === "list" ? (
								<ul key={i}>
									{block.items?.map((item, j) => (
										<li key={j}>{item}</li>
									))}
								</ul>
							) : (
								<p key={i}>{block.text}</p>
							),
						)}
					</article>
				</Card>

				<aside className="tnd-doc-layout__related" aria-label={t("project.docs.relatedLabel")}>
					<Card padded className="tnd-stack">
						<div className="tnd-row tnd-row--between">
							<span className="tnd-itemrow__title">{t("project.docs.relatedTasks")}</span>
							<Button variant="ghost" size="sm" leadingIcon={<Icon name="link" size={14} />}>
								{t("project.docs.linkToTask")}
							</Button>
						</div>
						<ul className="tnd-list-reset tnd-stack">
							{page.relatedTasks.map((ref) => (
								<li key={ref} className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
									<Icon name="checkSquare" size={16} aria-hidden />
									<Link
										to={href("board")}
										className="tnd-backlog__ref"
										style={{ textDecoration: "none" }}
									>
										{ref}
									</Link>
								</li>
							))}
						</ul>
						<hr style={{ border: 0, borderTop: "1px solid var(--tnd-color-border)" }} />
						<span className="tnd-itemrow__title">{t("project.docs.relatedComments")}</span>
						{/* Comments live inline on the item they're attached to (no
						standalone screen — the Discussions module was withdrawn, see
						the design spec §6), so these are informational, not links. */}
						<ul className="tnd-list-reset tnd-stack">
							{page.relatedComments.map((title) => (
								<li key={title} className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
									<Icon name="comments" size={16} aria-hidden />
									<span className="tnd-itemrow__title" style={{ fontWeight: 400 }}>
										{title}
									</span>
								</li>
							))}
						</ul>
					</Card>
				</aside>
			</div>
		</ProjectScreen>
	);
}

/* ===================================================================== Reports */

export function ProjectReportsPage() {
	const { t } = useTranslation();
	const project = useProject();
	if (!project) return null;

	// PROJECT-scoped report cards (these are this project's reports, not global).
	return (
		<ProjectScreen>
			<ProjectPageHeader
				title={t("project.reports.title")}
				actions={
					<Button variant="accent" leadingIcon={<Icon name="plus" size={16} />}>
						{t("project.reports.newReport")}
					</Button>
				}
			/>

			<ProjectSection
				title={t("project.reports.projectReports")}
				aria-label={t("project.reports.projectReports")}
			>
				<div className="tnd-grid tnd-grid--two">
					{REPORTS.map((r) => (
						<Card key={r.id} padded className="tnd-report-card">
							<div className="tnd-row tnd-row--between">
								<span className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
									<span className="tnd-metriccard__icon" aria-hidden="true">
										<Icon name={r.icon} size={18} />
									</span>
									<span className="tnd-itemrow__title" style={{ fontSize: "var(--tnd-text-md)" }}>
										{r.name}
									</span>
								</span>
								<Badge tone="brand">{r.module}</Badge>
							</div>
							<p className="tnd-subtle" style={{ margin: 0 }}>
								{r.description}
							</p>
							{r.id === "report-burndown" ? (
								<Sparkline />
							) : (
								<MiniBars seed={r.id.length} accentLast={r.id === "report-velocity"} />
							)}
							<div className="tnd-row tnd-row--between">
								<span className="tnd-report-card__metric">{r.metric}</span>
								<span className="tnd-delta">{r.trend}</span>
							</div>
						</Card>
					))}
				</div>
			</ProjectSection>

			<ProjectSection
				title={t("project.reports.customReports")}
				aria-label={t("project.reports.customReports")}
			>
				<EmptyState
					icon={<Icon name="bars" size={22} />}
					title={t("project.reports.emptyTitle")}
					description={t("project.reports.emptyDescription", {
						base: EMPTY_REPORT.description,
						project: project.name,
					})}
					action={
						<Button variant="accent" leadingIcon={<Icon name="plus" size={16} />}>
							{t("project.reports.createReport")}
						</Button>
					}
				/>
			</ProjectSection>
		</ProjectScreen>
	);
}

/** A lightweight CSS bar chart (decorative; meaning carried by the metric/trend text). */
function MiniBars({ seed, accentLast }: { seed: number; accentLast?: boolean }) {
	const bars = [42, 60, 48, 72, 64, 88].map((b, i) => Math.min(100, b + ((seed * (i + 1)) % 15)));
	return (
		<div className="tnd-minibars" aria-hidden="true">
			{bars.map((h, i) => (
				<span
					key={i}
					className="tnd-minibars__bar"
					data-accent={accentLast && i === bars.length - 1 ? "true" : undefined}
					style={{ height: `${h}%` }}
				/>
			))}
		</div>
	);
}

/** A lightweight SVG burndown sparkline (decorative). */
function Sparkline() {
	const ideal = "0,4 120,52";
	const actual = "0,4 24,14 48,16 72,30 96,34 120,44";
	return (
		<svg className="tnd-spark" viewBox="0 0 120 56" preserveAspectRatio="none" aria-hidden="true">
			<polyline
				points={ideal}
				fill="none"
				stroke="var(--tnd-color-border-strong)"
				strokeWidth="1.5"
				strokeDasharray="4 4"
			/>
			<polyline
				points={actual}
				fill="none"
				stroke="var(--tnd-color-brand)"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/* ==================================================================== Settings */

export function ProjectSettingsPage() {
	const { t } = useTranslation();
	const project = useProject();

	// Initial enabled state derives from the project's modules (display→short map).
	const initial = useMemo(
		() =>
			Object.fromEntries(
				MODULE_CATALOG.map((m) => [
					m.id,
					project ? project.modules.includes(displayToCatalog(m.name)) : false,
				]),
			),
		[project],
	);

	const [enabled, setEnabled] = useState<Record<string, boolean>>(initial);
	const dirty = useMemo(
		() => Object.keys(initial).some((k) => initial[k] !== enabled[k]),
		[initial, enabled],
	);

	if (!project) return null;

	const setModule = (id: string, next: boolean) => setEnabled((s) => ({ ...s, [id]: next }));
	const enabledModules = MODULE_CATALOG.filter((m) => enabled[m.id]);

	return (
		<ProjectScreen>
			<ProjectPageHeader title={t("project.settings.title")} />

			<div className="tnd-settings-grid">
				<div>
					<ProjectSection
						title={t("project.settings.modules")}
						hint={t("project.settings.modulesEnabledCount", {
							enabled: enabledModules.length,
							total: MODULE_CATALOG.length,
						})}
						aria-label={t("project.settings.moduleTogglesLabel")}
					>
						<div className="tnd-grid tnd-grid--modules">
							{MODULE_CATALOG.map((m) => {
								const status = m.locked
									? "Installed"
									: enabled[m.id]
										? "Enabled"
										: m.status === "Experimental"
											? "Experimental"
											: "Disabled";
								return (
									<ModuleCard
										key={m.id}
										name={m.name}
										meta={`${m.category} · v${m.version}`}
										description={m.description}
										status={status}
										statusLabel={t(`extensions.moduleStatus.${status}` as never)}
										enableLabel={t("common.enable")}
										disableLabel={t("common.disable")}
										icon={<Icon name={m.icon} size={20} />}
										enabled={enabled[m.id]}
										toggleDisabled={m.locked}
										onToggle={(next) => setModule(m.id, next)}
									/>
								);
							})}
						</div>
					</ProjectSection>

					<ProjectSection
						title={t("project.settings.permissions")}
						aria-label={t("project.settings.permissionsLabel")}
					>
						<Card>
							<CardSection>
								{enabledModules.map((m) => (
									<PermissionRow key={m.id} module={m.name} icon={m.icon} />
								))}
							</CardSection>
						</Card>
					</ProjectSection>
				</div>

				<div>
					<ProjectSection
						title={t("project.settings.customization")}
						aria-label={t("project.settings.customization")}
					>
						<Card>
							<CardSection>
								<SettingRow label={t("project.settings.projectKey")} value={project.key} mono />
								<SettingRow
									label={t("project.settings.workflowMethod")}
									value={project.method === "scrum" ? "Scrum" : "Kanban"}
								/>
								<SettingRow
									label={t("project.settings.status")}
									value={t(`projects.status.${PROJECT_STATUS_KEY[project.status]}` as never, {
										defaultValue: project.status,
									})}
								/>
								<SettingRow label={t("project.settings.owner")} value={project.owner.name} />
							</CardSection>
						</Card>
					</ProjectSection>

					<ProjectSection
						title={t("project.settings.dangerZone")}
						aria-label={t("project.settings.dangerZone")}
					>
						<Card padded className="tnd-stack">
							<p className="tnd-subtle" style={{ margin: 0 }}>
								{t("project.settings.dangerNote")}
							</p>
							<Button variant="secondary" size="sm">
								{t("project.settings.archiveProject")}
							</Button>
						</Card>
					</ProjectSection>
				</div>
			</div>

			{dirty ? (
				<div className="tnd-savebar" role="status" aria-live="polite">
					<span className="tnd-savebar__note">
						<Icon name="alert" size={16} aria-hidden /> {t("project.settings.unsavedChanges")}
					</span>
					<span className="tnd-savebar__actions">
						<Button variant="secondary" onClick={() => setEnabled(initial)}>
							{t("common.cancel")}
						</Button>
						<Button variant="accent" onClick={() => setEnabled((s) => ({ ...s }))}>
							{t("common.saveChanges")}
						</Button>
					</span>
				</div>
			) : null}
		</ProjectScreen>
	);
}

/** Project status -> projects.status.<key> for the settings detail row. */
const PROJECT_STATUS_KEY: Record<string, string> = {
	Active: "active",
	Paused: "paused",
	Archived: "archived",
};

function PermissionRow({ module, icon }: { module: string; icon: IconName }) {
	const { t } = useTranslation();
	const [level, setLevel] = useState<"all" | "members">("all");
	return (
		<div className="tnd-perm-row">
			<Icon name={icon} size={18} aria-hidden />
			<span className="tnd-perm-row__main">
				<span className="tnd-itemrow__title">{module}</span>
				<span className="tnd-itemrow__meta">{t("project.settings.whoCanUse")}</span>
			</span>
			<div
				className="tnd-board-toolbar__group"
				role="group"
				aria-label={t("project.settings.permissionsGroupLabel", { module })}
			>
				<button
					type="button"
					className="tnd-segmented"
					aria-pressed={level === "all"}
					onClick={() => setLevel("all")}
				>
					{t("project.settings.everyone")}
				</button>
				<button
					type="button"
					className="tnd-segmented"
					aria-pressed={level === "members"}
					onClick={() => setLevel("members")}
				>
					{t("project.settings.members")}
				</button>
			</div>
		</div>
	);
}

function SettingRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
	return (
		<div className="tnd-itemrow">
			<span className="tnd-itemrow__main">
				<span className="tnd-itemrow__title">{label}</span>
			</span>
			<span className={mono ? "tnd-mono tnd-muted" : "tnd-muted"}>{value}</span>
		</div>
	);
}

/* ===================================================================== helpers */

/** Group an array, preserving first-seen key order. */
function groupBy<T>(items: T[], keyOf: (item: T) => string): [string, T[]][] {
	const order: string[] = [];
	const map = new Map<string, T[]>();
	for (const item of items) {
		const key = keyOf(item);
		if (!map.has(key)) {
			map.set(key, []);
			order.push(key);
		}
		map.get(key)!.push(item);
	}
	return order.map((k) => [k, map.get(k)!]);
}
