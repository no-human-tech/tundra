import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { WorkItemPriority } from "@tundra/domain";
import {
	Avatar,
	Badge,
	Button,
	Chip,
	Drawer,
	Icon,
	Tabs,
	Toggle,
	type ChipTone,
	type TabItem,
} from "@tundra/ui";
import type { TFunction } from "i18next";

import type { BoardCard } from "../data/index.js";
import { formatDecimalHours } from "../i18n/formatNumber.js";
import { priorityText } from "../i18n/workItemLabels.js";
import { getTaskDetail, type TaskDetail } from "../data/taskDetail.js";

/**
 * The Board's task detail drawer. Composes the ui <Drawer> (slide-over with
 * Esc/overlay close + focus trap) and <Tabs> (in-page ARIA tab pattern) into the
 * full task view: title, status, assignee, estimate, time spent, labels, a
 * checklist (with the "Assigned to … · Appears in My Tasks" affordance on the
 * signed-in user's items), comments, and the module-contributed-panels strip.
 *
 * Tabs: Details / Activity / Time / Links / Automation. The Time and Automation
 * tabs are labelled "Contributed by the … module" — the drawer is the host surface
 * modules register panels against (task.drawer.panel extension point), so module
 * boundaries stay visible in the product.
 */

const PRIORITY_TONE: Record<WorkItemPriority, ChipTone> = {
	[WorkItemPriority.Low]: "neutral",
	[WorkItemPriority.Medium]: "info",
	[WorkItemPriority.High]: "warning",
	[WorkItemPriority.Urgent]: "danger",
};

/** Build the drawer tab items with translated labels. */
function buildTabs(t: TFunction): TabItem[] {
	return [
		{ id: "details", label: t("taskDrawer.tabs.details"), icon: <Icon name="tasks" size={15} /> },
		{ id: "activity", label: t("taskDrawer.tabs.activity"), icon: <Icon name="time" size={15} /> },
		{ id: "time", label: t("taskDrawer.tabs.time"), icon: <Icon name="clock" size={15} /> },
		{ id: "links", label: t("taskDrawer.tabs.links"), icon: <Icon name="link" size={15} /> },
		{
			id: "automation",
			label: t("taskDrawer.tabs.automation"),
			icon: <Icon name="bolt" size={15} />,
		},
	];
}

export interface TaskDrawerProps {
	/** the board card to show (null/undefined closes the drawer) */
	card: BoardCard | undefined;
	/** the column the card currently sits in (shown in the subtitle) */
	columnName?: string;
	/** the project display name (subtitle context) */
	projectName: string;
	onClose: () => void;
}

export function TaskDrawer({ card, columnName, projectName, onClose }: TaskDrawerProps) {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState("details");

	// Resolve detail unconditionally (hooks first); guard the render below.
	const open = Boolean(card);
	const detail = card ? getTaskDetail(card.id) : undefined;

	return (
		<Drawer
			open={open}
			onClose={onClose}
			closeLabel={t("shell.drawerClose")}
			title={card?.title ?? ""}
			subtitle={
				card
					? `${projectName} · ${columnName ?? card.column}${card.reference ? ` · ${card.reference}` : ""}`
					: undefined
			}
			topMeta={
				card ? (
					<span className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
						{card.reference ? <Badge tone="neutral">{card.reference}</Badge> : null}
						{card.blocked ? (
							<Badge tone="accent" uppercase icon={<Icon name="alert" size={13} />}>
								{t("common.blocked")}
							</Badge>
						) : null}
						{card.priority ? (
							<Chip tone={PRIORITY_TONE[card.priority]}>{priorityText(t, card.priority)}</Chip>
						) : null}
					</span>
				) : null
			}
			tabs={
				<Tabs
					items={buildTabs(t)}
					activeId={activeTab}
					onSelect={setActiveTab}
					aria-label={t("taskDrawer.detailLabel")}
				/>
			}
		>
			{card && detail ? (
				<div
					role="tabpanel"
					id={`tnd-tabpanel-${activeTab}`}
					aria-labelledby={`tnd-tab-${activeTab}`}
					tabIndex={0}
				>
					{activeTab === "details" ? <DetailsPanel card={card} detail={detail} /> : null}
					{activeTab === "activity" ? <ActivityPanel detail={detail} /> : null}
					{activeTab === "time" ? <TimePanel detail={detail} /> : null}
					{activeTab === "links" ? <LinksPanel detail={detail} /> : null}
					{activeTab === "automation" ? <AutomationPanel detail={detail} /> : null}
				</div>
			) : null}
		</Drawer>
	);
}

/* ----------------------------------------------------------------- Details */

function DetailsPanel({ card, detail }: { card: BoardCard; detail: TaskDetail }) {
	const { t, i18n } = useTranslation();
	return (
		<div className="tnd-stack" style={{ gap: "var(--tnd-space-5)" }}>
			{/* Module-contributed panels strip. */}
			<div>
				<div className="tnd-tdrawer__module-note">
					<Icon name="blocks" size={14} aria-hidden /> {t("taskDrawer.panelsContributed")}
				</div>
				<div className="tnd-tdrawer__panels">
					{detail.modulePanels.map((p) => (
						<span key={p} className="tnd-tdrawer__panel-pill">
							<Icon name="plug" size={12} aria-hidden /> {p}
						</span>
					))}
				</div>
			</div>

			<dl className="tnd-stack" style={{ gap: 0 }}>
				<Row term={t("taskDrawer.status")} value={card.column} />
				<Row
					term={t("taskDrawer.assignee")}
					value={
						card.assigneeName ? (
							<span className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
								<Avatar name={card.assigneeName} size="sm" /> {card.assigneeName}
							</span>
						) : (
							t("common.unassigned")
						)
					}
				/>
				<Row
					term={t("taskDrawer.estimate")}
					value={
						<span className="tnd-mono">
							{typeof card.points === "number" ? t("common.points", { count: card.points }) : "—"}
						</span>
					}
				/>
				<Row
					term={t("taskDrawer.timeSpent")}
					value={
						<span className="tnd-mono">
							{formatDecimalHours(detail.timeSpentHours, i18n.language)}h
						</span>
					}
				/>
				{typeof card.comments === "number" ? (
					<Row
						term={t("taskDrawer.comments")}
						value={<span className="tnd-mono">{card.comments}</span>}
					/>
				) : null}
			</dl>

			{card.boardLabels.length > 0 ? (
				<div>
					<p className="tnd-subtle" style={{ margin: "0 0 var(--tnd-space-2)" }}>
						{t("taskDrawer.labels")}
					</p>
					<div className="tnd-backlog__labels">
						{card.boardLabels.map((l) => (
							<span key={l.name} className="tnd-label-pill">
								{l.name}
							</span>
						))}
					</div>
				</div>
			) : null}

			<div>
				<p className="tnd-subtle" style={{ margin: "0 0 var(--tnd-space-2)" }}>
					{t("taskDrawer.checklist")}
				</p>
				<ul className="tnd-checklist" aria-label={t("taskDrawer.checklistLabel")}>
					{detail.checklist.map((c) => (
						<li
							key={c.id}
							className="tnd-checklist__item"
							data-mine={c.isMine ? "true" : undefined}
						>
							<Icon name={c.done ? "checkSquare" : "tasks"} size={18} aria-hidden />
							<span className="tnd-checklist__main">
								<span className="tnd-checklist__text" data-done={c.done ? "true" : undefined}>
									{c.text}
								</span>
								<span className="tnd-checklist__meta">
									{t("taskDrawer.assignedTo", { name: c.assignee.shortName })}
									{c.isMine ? ` · ${t("taskDrawer.appearsInMyTasks")}` : ""}
								</span>
							</span>
							{c.isMine ? <Chip tone="brand">{t("common.you")}</Chip> : null}
						</li>
					))}
				</ul>
			</div>

			<div>
				<p className="tnd-subtle" style={{ margin: "0 0 var(--tnd-space-2)" }}>
					{t("taskDrawer.comments")}
				</p>
				<ul className="tnd-list-reset tnd-stack">
					{detail.comments.map((co) => (
						<li
							key={co.id}
							className="tnd-row"
							style={{ alignItems: "flex-start", flexWrap: "nowrap" }}
						>
							<Avatar name={co.author.name} size="sm" />
							<span className="tnd-itemrow__main">
								<span className="tnd-disc-thread__author">
									{co.author.shortName}{" "}
									<span className="tnd-disc-thread__when">
										{t("taskDrawer.commentAgoSuffix", { when: co.when })}
									</span>
								</span>
								<p className="tnd-disc-thread__text">{co.text}</p>
							</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}

/* ---------------------------------------------------------------- Activity */

function ActivityPanel({ detail }: { detail: TaskDetail }) {
	const { t } = useTranslation();
	return (
		<ul className="tnd-activity" aria-label={t("taskDrawer.activityLabel")}>
			{detail.activity.map((a) => (
				<li key={a.id} className="tnd-activity__item">
					<span className="tnd-activity__when">{a.when}</span>
					<span className="tnd-itemrow__title" style={{ fontWeight: 400 }}>
						<strong>{a.who}</strong> {a.action}
					</span>
				</li>
			))}
		</ul>
	);
}

/* -------------------------------------------------------------------- Time */

function TimePanel({ detail }: { detail: TaskDetail }) {
	const { t, i18n } = useTranslation();
	const pct = Math.min(100, Math.round((detail.timeSpentHours / detail.estimateHours) * 100));
	return (
		<div className="tnd-stack" style={{ gap: "var(--tnd-space-4)" }}>
			<p className="tnd-tdrawer__module-note">
				<Icon name="clock" size={14} aria-hidden /> {t("taskDrawer.timeContributed")}
			</p>
			<div className="tnd-row tnd-row--between">
				<span className="tnd-report-card__metric">
					{formatDecimalHours(detail.timeSpentHours, i18n.language)}h
				</span>
				<span className="tnd-subtle">
					{t("taskDrawer.ofEstimated", { hours: detail.estimateHours })}
				</span>
			</div>
			<span className="tnd-meterbar" aria-hidden="true">
				<span className="tnd-meterbar__fill" style={{ width: `${pct}%` }} />
			</span>
			<p className="tnd-subtle" style={{ margin: 0 }}>
				{t("taskDrawer.estimateLogged", { pct })}
			</p>
		</div>
	);
}

/* ------------------------------------------------------------------- Links */

function LinksPanel({ detail }: { detail: TaskDetail }) {
	return (
		<ul className="tnd-list-reset tnd-stack">
			{detail.links.map((l) => (
				<li key={l.id} className="tnd-itemrow">
					<Icon name="link" size={16} aria-hidden />
					<span className="tnd-itemrow__main">
						<span className="tnd-itemrow__title">{l.label}</span>
						<span className="tnd-itemrow__meta">{l.kind}</span>
					</span>
				</li>
			))}
		</ul>
	);
}

/* -------------------------------------------------------------- Automation */

function AutomationPanel({ detail }: { detail: TaskDetail }) {
	const { t } = useTranslation();
	const [on, setOn] = useState<Record<string, boolean>>(() =>
		Object.fromEntries(detail.automation.map((r) => [r.id, true])),
	);
	return (
		<div className="tnd-stack" style={{ gap: "var(--tnd-space-4)" }}>
			<p className="tnd-tdrawer__module-note">
				<Icon name="bolt" size={14} aria-hidden /> {t("taskDrawer.automationContributed")}
			</p>
			<ul className="tnd-list-reset tnd-stack">
				{detail.automation.map((r) => (
					<li key={r.id} className="tnd-itemrow">
						<span className="tnd-itemrow__main">
							<span className="tnd-itemrow__title">{r.when}</span>
							<span className="tnd-itemrow__meta">{r.then}</span>
						</span>
						<Toggle
							checked={Boolean(on[r.id])}
							label={t("taskDrawer.toggleAutomation", {
								action: on[r.id] ? t("common.disable") : t("common.enable"),
								rule: r.when,
							})}
							onChange={(next) => setOn((s) => ({ ...s, [r.id]: next }))}
						/>
					</li>
				))}
			</ul>
			<Button variant="ghost" size="sm" leadingIcon={<Icon name="plus" size={14} />}>
				{t("taskDrawer.addRule")}
			</Button>
		</div>
	);
}

/* ----------------------------------------------------------------- helpers */

function Row({ term, value }: { term: string; value: ReactNode }) {
	return (
		<div
			className="tnd-row tnd-row--between"
			style={{ borderBottom: "1px solid var(--tnd-color-border)", padding: "var(--tnd-space-3) 0" }}
		>
			<dt className="tnd-subtle">{term}</dt>
			<dd style={{ margin: 0, fontWeight: 600 }}>{value}</dd>
		</div>
	);
}
