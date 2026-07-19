import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { WorkItemPriority, WorkItemSource, WorkItemStatus } from "@tundra/domain";
import {
	Badge,
	Button,
	Card,
	CardSection,
	Chip,
	Drawer,
	EmptyState,
	Icon,
	ModuleBadge,
	Skeleton,
	WorkItemList,
} from "@tundra/ui";
import type { TFunction } from "i18next";

import {
	loadMyTasksView,
	loadAuditHistory,
	revertAuditEvent,
	type MyTasksView,
	type ApiAuditEvent,
} from "../api/queries.js";
import { PageHeader } from "../components/PageHeader.js";
import { FilterChip } from "../components/sections.js";
import { statusText as statusTextI18n, workItemLabels } from "../i18n/workItemLabels.js";
import { auditActionMessage } from "../i18n/codes.js";
import {
	ME,
	findStory,
	myTasksEntries,
	myTasksGroups,
	type MyTaskEntry,
	type MyTasksGroup,
	type MyTasksGroupName,
} from "../data/index.js";

const GROUP_ACCENT: Record<string, string> = {
	Today: "var(--tnd-color-accent)",
	Upcoming: "var(--tnd-color-brand)",
	Blocked: "var(--tnd-color-accent)",
	"No due date": "var(--tnd-color-text-subtle)",
	"Done recently": "var(--tnd-color-success)",
};

/** Map the demo/live group name (English, from the domain grouping) -> i18n keys. */
const GROUP_KEY: Record<MyTasksGroupName, string> = {
	Today: "today",
	Upcoming: "upcoming",
	Blocked: "blocked",
	"No due date": "noDueDate",
	"Done recently": "doneRecently",
};

function groupTitle(t: TFunction, name: MyTasksGroupName): string {
	return t(`myTasks.groups.${GROUP_KEY[name]}` as never, { defaultValue: name });
}

function groupHint(t: TFunction, name: MyTasksGroupName): string {
	return t(`myTasks.groupHints.${GROUP_KEY[name]}` as never);
}

/** Lower ranks are worked first when "Plan my day" orders today's queue. */
const PRIORITY_RANK: Record<WorkItemPriority, number> = {
	[WorkItemPriority.Urgent]: 0,
	[WorkItemPriority.High]: 1,
	[WorkItemPriority.Medium]: 2,
	[WorkItemPriority.Low]: 3,
};

/** What the page is currently rendering, after the mount-time fetch resolves. */
type QueueState =
	| { phase: "loading" }
	// Live API data (may be an empty queue).
	| { phase: "live"; view: MyTasksView }
	// API unreachable / errored — fall back to the clearly-marked demo fixtures.
	| { phase: "demo" };

/**
 * The unified "My Tasks" queue. Every assigned work item, from every source
 * (task, story checklist, subtask, bug, review, docs, automation, extension), is
 * rendered by ONE WorkItemRow — source is metadata (a badge), never a layout.
 *
 * Data: on mount we fetch viewer + projects + myTasks from the GraphQL API
 * (`loadMyTasksView`). While that is in flight we show Skeleton rows; if the API
 * is unreachable or errors we fall back to the bundled demo fixtures with a
 * VISIBLE "Demo data — API unavailable" marker so live and demo are never
 * confused; a live-but-empty queue shows an EmptyState. On success we render the
 * same grouped lists the demo path uses.
 *
 * Layout (unchanged across all data sources, full page width — no side rail):
 * a filter bar (Assignee pinned to "Me"), a horizontal metrics band (assigned ·
 * due today · blocked · from story checklists), an optional "Plan my day" panel,
 * then the full-width grouped labelled lists (Today / Upcoming / Blocked / No
 * due date / Done recently). Clicking an item opens a Drawer; for a demo
 * story-checklist item the drawer shows the parent story's checklist with the
 * assigned item highlighted ("Appears in My Tasks").
 */
type DrawerTab = "details" | "history";

export function MyTasksPage() {
	const { t } = useTranslation();
	const labels = workItemLabels(t);
	const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
	const [drawerTab, setDrawerTab] = useState<DrawerTab>("details");
	const [auditEvents, setAuditEvents] = useState<ApiAuditEvent[]>([]);
	const [auditLoading, setAuditLoading] = useState(false);
	const [revertingId, setRevertingId] = useState<string | null>(null);
	const [state, setState] = useState<QueueState>({ phase: "loading" });
	// the design spec §7.12: "Plan my day" — a lightweight, client-only affordance
	// that orders today's queue (blocked first, then priority) into a short,
	// full-width panel shown under the metrics band. No scheduling backend; it's a
	// reordered read of `groups`.
	const [planOpen, setPlanOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;
		loadMyTasksView()
			.then((view) => {
				if (!cancelled) setState({ phase: "live", view });
			})
			.catch(() => {
				// Network/GraphQL failure (the default no-API e2e run lands here): show
				// the bundled demo queue with a visible marker rather than an error wall.
				if (!cancelled) setState({ phase: "demo" });
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Load audit history when the History tab is selected for the current item.
	useEffect(() => {
		if (!selectedId || drawerTab !== "history") {
			return;
		}
		let cancelled = false;
		setAuditLoading(true);
		loadAuditHistory("WorkItem", selectedId)
			.then((events) => {
				if (!cancelled) setAuditEvents(events);
			})
			.catch(() => {
				if (!cancelled) setAuditEvents([]);
			})
			.finally(() => {
				if (!cancelled) setAuditLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, [selectedId, drawerTab]);

	const handleRevert = async (eventId: string) => {
		setRevertingId(eventId);
		try {
			await revertAuditEvent(eventId);
			// Refresh history after a successful revert.
			if (selectedId) {
				const events = await loadAuditHistory("WorkItem", selectedId);
				setAuditEvents(events);
			}
		} finally {
			setRevertingId(null);
		}
	};

	const isDemo = state.phase === "demo";
	const isLoading = state.phase === "loading";

	// Resolve the entries + groups for the current data source. Demo uses the
	// bundled fixtures (and their story-checklist drawer); live uses the fetched,
	// joined view.
	const entries: MyTaskEntry[] = isDemo
		? myTasksEntries
		: state.phase === "live"
			? state.view.entries
			: [];
	const groups: MyTasksGroup[] = isDemo
		? myTasksGroups
		: state.phase === "live"
			? state.view.groups
			: [];

	// Today's items, ordered blocked-first then by priority — the "Plan my day"
	// suggestion. Recomputed whenever the queue changes; purely a display order.
	const planEntries = useMemo(() => {
		const today = groups.find((g) => g.name === "Today");
		if (!today) return [];
		return [...today.entries].sort((a, b) => {
			const blockedDiff =
				Number(b.item.status === WorkItemStatus.Blocked) -
				Number(a.item.status === WorkItemStatus.Blocked);
			if (blockedDiff !== 0) return blockedDiff;
			const rankA = a.item.priority
				? PRIORITY_RANK[a.item.priority]
				: PRIORITY_RANK[WorkItemPriority.Low];
			const rankB = b.item.priority
				? PRIORITY_RANK[b.item.priority]
				: PRIORITY_RANK[WorkItemPriority.Low];
			return rankA - rankB;
		});
	}, [groups]);

	const active = entries.filter((e) => e.group !== "Done recently");
	const metrics = {
		assigned: active.length,
		dueToday: active.filter((e) => e.group === "Today").length,
		blocked: active.filter((e) => e.group === "Blocked").length,
		fromStories: active.filter((e) => e.item.source === WorkItemSource.StoryChecklist).length,
	};

	const selected = selectedId ? entries.find((e) => e.item.id === selectedId) : undefined;
	// Story-checklist drawers (parent story + highlighted item) exist only in the
	// demo fixtures; live items open the generic detail drawer.
	const story = isDemo && selected?.storyId ? findStory(selected.storyId) : undefined;

	const isEmpty = !isLoading && groups.length === 0;

	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("myTasks.kicker")}
				title={t("myTasks.title")}
				lead={t("myTasks.lead")}
				actions={isDemo ? <DemoMarker /> : null}
			/>

			{isLoading ? (
				<QueueLoading />
			) : isEmpty ? (
				<EmptyState
					icon={<Icon name="tasks" size={28} />}
					title={t("myTasks.emptyTitle")}
					description={t("myTasks.emptyDescription")}
				/>
			) : (
				<>
					<div className="tnd-filterbar" role="group" aria-label={t("myTasks.filters.ariaLabel")}>
						<FilterChip label={t("myTasks.filters.assignee")} value={ME.shortName} pinned />
						<FilterChip label={t("myTasks.filters.project")} value={t("common.all")} />
						<FilterChip label={t("myTasks.filters.status")} value={t("common.any")} />
						<FilterChip label={t("myTasks.filters.due")} value={t("common.any")} />
						<FilterChip label={t("myTasks.filters.priority")} value={t("common.any")} />
						<FilterChip label={t("myTasks.filters.source")} value={t("common.any")} />
						<FilterChip label={t("myTasks.filters.module")} value={t("common.any")} />
						<FilterChip label={t("myTasks.filters.sprint")} value={t("common.any")} />
						<Button
							variant="accent"
							size="sm"
							leadingIcon={<Icon name="bolt" size={14} aria-hidden />}
							style={{ marginLeft: "auto" }}
							onClick={() => setPlanOpen(true)}
						>
							{t("myTasks.planMyDay")}
						</Button>
					</div>

					{/* the design spec §7.12 (revised): the queue is full page width —
					    no side rail. The metrics band sits between the filter bar and
					    the task list; "Plan my day" opens a full-width panel under the
					    metrics band, not a rail. */}
					<Card padded style={{ marginTop: "var(--tnd-space-4)" }}>
						<div
							className="tnd-queue-metrics"
							style={{ padding: 0, margin: 0 }}
							data-testid="mytasks-metrics-band"
						>
							<Metric value={metrics.assigned} label={t("myTasks.metrics.assigned")} />
							<Metric value={metrics.dueToday} label={t("myTasks.metrics.dueToday")} accent />
							<Metric value={metrics.blocked} label={t("myTasks.metrics.blocked")} accent />
							<Metric value={metrics.fromStories} label={t("myTasks.metrics.fromStories")} ext />
						</div>
					</Card>

					{planOpen ? (
						<Card
							padded
							className="tnd-stack"
							style={{ marginTop: "var(--tnd-space-4)" }}
							data-testid="mytasks-plan-panel"
						>
							<div className="tnd-section__head" style={{ marginBottom: 0 }}>
								<h2 className="tnd-section__title">{t("myTasks.planTitle")}</h2>
								<button
									type="button"
									className="tnd-button tnd-button--ghost tnd-button--sm"
									onClick={() => setPlanOpen(false)}
								>
									{t("shell.drawerClose")}
								</button>
							</div>
							<p className="tnd-subtle" style={{ margin: 0 }}>
								{t("myTasks.planHint")}
							</p>
							{planEntries.length === 0 ? (
								<p className="tnd-subtle" style={{ margin: 0 }}>
									{t("myTasks.planEmpty")}
								</p>
							) : (
								<ol className="tnd-list-reset tnd-stack" aria-label={t("myTasks.planTitle")}>
									{planEntries.map((entry, i) => (
										<li key={entry.item.id} className="tnd-itemrow">
											<span
												aria-hidden="true"
												style={{
													display: "inline-flex",
													alignItems: "center",
													justifyContent: "center",
													width: "1.5rem",
													height: "1.5rem",
													borderRadius: "999px",
													background: "var(--tnd-color-brand-soft)",
													color: "var(--tnd-color-brand)",
													fontSize: "var(--tnd-text-xs)",
													fontWeight: "var(--tnd-weight-bold)",
													flex: "none",
												}}
											>
												{i + 1}
											</span>
											<span className="tnd-itemrow__main">
												<span className="tnd-itemrow__title">{entry.item.title}</span>
												<span className="tnd-itemrow__meta">
													{entry.item.projectName}
													{entry.estimate ? ` · ${entry.estimate}` : ""}
												</span>
											</span>
										</li>
									))}
								</ol>
							)}
						</Card>
					) : null}

					<div style={{ marginTop: "var(--tnd-space-4)" }} data-testid="mytasks-queue">
						{groups.map((group) => {
							const title = groupTitle(t, group.name);
							return (
								<section key={group.name} className="tnd-queue-group" aria-label={title}>
									<div className="tnd-queue-group__head">
										<span
											className="tnd-queue-group__dot"
											style={{ background: GROUP_ACCENT[group.name] }}
											aria-hidden="true"
										/>
										<span className="tnd-queue-group__name">{title}</span>
										<span className="tnd-queue-group__count">{group.entries.length}</span>
										<span className="tnd-queue-group__hint">{groupHint(t, group.name)}</span>
									</div>
									<WorkItemList
										items={group.entries.map((e) => e.item)}
										selectedId={selectedId}
										onOpen={setSelectedId}
										aria-label={title}
										labels={labels}
									/>
								</section>
							);
						})}
					</div>
				</>
			)}

			<Drawer
				open={Boolean(selected)}
				onClose={() => {
					setSelectedId(undefined);
					setDrawerTab("details");
					setAuditEvents([]);
				}}
				closeLabel={t("shell.drawerClose")}
				title={selected?.item.title ?? ""}
				subtitle={
					selected
						? `${selected.item.projectName} · ${selected.parent}${selected.item.reference ? ` · ${selected.item.reference}` : ""}`
						: undefined
				}
				topMeta={
					selected ? (
						<ModuleBadge
							source={selected.item.source}
							moduleLabel={selected.item.moduleLabel}
							size="sm"
						/>
					) : null
				}
			>
				{selected ? (
					<>
						{/* Tab switcher */}
						<CardSection>
							<div
								role="tablist"
								aria-label={t("auditHistory.tabListLabel")}
								className="tnd-row"
								style={{ gap: "var(--tnd-space-2)" }}
							>
								<button
									role="tab"
									aria-selected={drawerTab === "details"}
									className={`tnd-tab${drawerTab === "details" ? " tnd-tab--active" : ""}`}
									onClick={() => setDrawerTab("details")}
									type="button"
								>
									{t("auditHistory.detailTab")}
								</button>
								<button
									role="tab"
									aria-selected={drawerTab === "history"}
									className={`tnd-tab${drawerTab === "history" ? " tnd-tab--active" : ""}`}
									onClick={() => setDrawerTab("history")}
									type="button"
								>
									{t("auditHistory.tab")}
								</button>
							</div>
						</CardSection>

						{/* Details tab */}
						{drawerTab === "details" ? (
							story ? (
								<>
									<CardSection>
										<div className="tnd-row tnd-row--between">
											<span className="tnd-itemrow__title">
												{t("myTasks.storyDrawerTitle", {
													reference: story.reference,
													title: story.title,
												})}
											</span>
											<Badge tone="ext">{t("myTasks.appearsInMyTasks")}</Badge>
										</div>
										<p className="tnd-subtle" style={{ marginTop: "var(--tnd-space-2)" }}>
											{t("myTasks.storyDrawerNote")}
										</p>
									</CardSection>
									<CardSection>
										<ul
											className="tnd-list-reset tnd-stack"
											aria-label={t("myTasks.storyChecklistLabel")}
										>
											{story.checklist.map((c) => (
												<li
													key={c.id}
													className="tnd-itemrow"
													style={
														c.isMine
															? {
																	background: "var(--tnd-color-brand-soft)",
																	borderRadius: "var(--tnd-radius-md)",
																	padding: "var(--tnd-space-3)",
																}
															: undefined
													}
												>
													<Icon name={c.done ? "checkSquare" : "tasks"} size={18} aria-hidden />
													<span className="tnd-itemrow__main">
														<span
															className="tnd-itemrow__title"
															style={
																c.done
																	? {
																			textDecoration: "line-through",
																			color: "var(--tnd-color-text-subtle)",
																		}
																	: undefined
															}
														>
															{c.text}
														</span>
														<span className="tnd-itemrow__meta">
															{c.assignee.shortName}
															{c.isMine ? ` · ${t("myTasks.assignedToYou")}` : ""}
														</span>
													</span>
													{c.isMine ? <Chip tone="brand">{t("common.you")}</Chip> : null}
												</li>
											))}
										</ul>
									</CardSection>
								</>
							) : (
								<CardSection>
									<dl className="tnd-stack">
										<DetailRow
											term={t("myTasks.detail.status")}
											value={statusTextI18n(t, selected.item.status)}
										/>
										<DetailRow
											term={t("myTasks.detail.project")}
											value={selected.item.projectName}
										/>
										<DetailRow term={t("myTasks.detail.parent")} value={selected.parent} />
										{selected.estimate ? (
											<DetailRow term={t("myTasks.detail.estimate")} value={selected.estimate} />
										) : null}
										{selected.item.dueAt ? (
											<DetailRow term={t("myTasks.detail.due")} value={selected.item.dueAt} />
										) : null}
										{typeof selected.comments === "number" ? (
											<DetailRow
												term={t("myTasks.detail.comments")}
												value={String(selected.comments)}
											/>
										) : null}
									</dl>
								</CardSection>
							)
						) : null}

						{/* History tab */}
						{drawerTab === "history" ? (
							<CardSection>
								{auditLoading ? (
									<div
										aria-busy="true"
										aria-label={t("auditHistory.loading")}
										className="tnd-stack"
									>
										{[0, 1, 2].map((i) => (
											<Skeleton key={i} height={48} radius="var(--tnd-radius-md)" />
										))}
									</div>
								) : auditEvents.length === 0 ? (
									<p className="tnd-subtle" style={{ margin: 0 }}>
										{t("auditHistory.empty")}
									</p>
								) : (
									<ol className="tnd-list-reset tnd-stack" aria-label={t("auditHistory.tab")}>
										{[...auditEvents].reverse().map((ev) => (
											<li key={ev.id} className="tnd-itemrow">
												<span className="tnd-itemrow__main">
													<span className="tnd-itemrow__title">
														{auditActionMessage(t, ev.action)}
													</span>
													<span className="tnd-itemrow__meta">
														{new Date(ev.occurredAt).toLocaleString()} ·{" "}
														{ev.actorUserId
															? t("auditHistory.by", { actor: ev.actorUserId })
															: t("auditHistory.unknown")}
														{ev.reversalOfEventId ? ` · ${t("auditHistory.isReversal")}` : null}
													</span>
												</span>
												{ev.reversibility === "Reversible" && !ev.reversalOfEventId ? (
													<button
														type="button"
														className="tnd-button tnd-button--ghost tnd-button--sm"
														disabled={revertingId === ev.id}
														onClick={() => void handleRevert(ev.id)}
														aria-label={t("auditHistory.revertLabel", { action: ev.action })}
													>
														{t("auditHistory.revert")}
													</button>
												) : ev.reversalOfEventId ? (
													<Badge tone="neutral">{t("auditHistory.reverted")}</Badge>
												) : null}
											</li>
										))}
									</ol>
								)}
							</CardSection>
						) : null}
					</>
				) : null}
			</Drawer>
		</div>
	);
}

/**
 * A loud, never-color-only marker shown in the page header when the screen is
 * rendering the bundled demo fixtures because the API was unreachable. Keeps live
 * and demo data unmistakable.
 */
function DemoMarker() {
	const { t } = useTranslation();
	return (
		<Chip tone="warning">
			<span aria-hidden="true" style={{ display: "inline-flex", marginRight: "0.35em" }}>
				<Icon name="bolt" size={14} />
			</span>
			{t("myTasks.demoMarker")}
		</Chip>
	);
}

/** Skeleton placeholders for the metrics card + the first grouped list. */
function QueueLoading() {
	const { t } = useTranslation();
	return (
		<div aria-busy="true" aria-label={t("myTasks.loading")}>
			<Card padded>
				<div className="tnd-queue-metrics" style={{ padding: 0, margin: 0 }}>
					{[0, 1, 2, 3].map((i) => (
						<span key={i} style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
							<Skeleton width={48} height={28} />
							<Skeleton variant="text" width={72} />
						</span>
					))}
				</div>
			</Card>
			<section
				className="tnd-queue-group"
				aria-hidden="true"
				style={{ marginTop: "var(--tnd-space-4)" }}
			>
				<div className="tnd-stack">
					{[0, 1, 2, 3, 4].map((i) => (
						<Skeleton key={i} height={56} radius="var(--tnd-radius-md)" />
					))}
				</div>
			</section>
		</div>
	);
}

function Metric({
	value,
	label,
	accent,
	ext,
}: {
	value: number;
	label: string;
	accent?: boolean;
	ext?: boolean;
}) {
	const color = accent
		? "var(--tnd-color-accent-ink)"
		: ext
			? "var(--tnd-color-ext-on-soft)"
			: "var(--tnd-color-text)";
	return (
		<span style={{ display: "inline-flex", flexDirection: "column" }}>
			<span style={{ fontSize: "var(--tnd-text-2xl)", fontWeight: 800, lineHeight: 1, color }}>
				{value}
			</span>
			<span className="tnd-subtle">{label}</span>
		</span>
	);
}

function DetailRow({ term, value }: { term: string; value: string }) {
	return (
		<div
			className="tnd-row tnd-row--between"
			style={{ borderBottom: "1px solid var(--tnd-color-border)", padding: "var(--tnd-space-2) 0" }}
		>
			<dt className="tnd-subtle">{term}</dt>
			<dd style={{ margin: 0, fontWeight: 600, textTransform: "capitalize" }}>{value}</dd>
		</div>
	);
}
