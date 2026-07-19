import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import {
	Avatar,
	Badge,
	Button,
	Card,
	CardSection,
	Chip,
	Drawer,
	EmptyState,
	ExtensionSlot,
	ICON_NAMES,
	Icon,
	IconButton,
	Logo,
	ModuleCard,
	Skeleton,
	StatusDot,
	Tabs,
	Toggle,
	type BadgeTone,
	type ChipTone,
} from "@tundra/ui";
import { WorkItemStatus } from "@tundra/domain";

import { PageHeader } from "../../components/PageHeader.js";
import { Section } from "../../components/sections.js";
import { statusText } from "../../i18n/workItemLabels.js";

interface Swatch {
	name: string;
	token: string;
}

const COLOR_SWATCHES: Swatch[] = [
	{ name: "Mint 100", token: "--tnd-color-mint-100" },
	{ name: "Mint 300", token: "--tnd-color-mint-300" },
	{ name: "Mint 400 (bright)", token: "--tnd-color-mint-400" },
	{ name: "Mint 500 (brand)", token: "--tnd-color-mint-500" },
	{ name: "Mint 600", token: "--tnd-color-mint-600" },
	{ name: "Mint 700 (ink)", token: "--tnd-color-mint-700" },
	{ name: "Orange 400 (accent)", token: "--tnd-color-orange-400" },
	{ name: "Orange 500", token: "--tnd-color-orange-500" },
	{ name: "Surface sunken", token: "--tnd-color-surface-sunken" },
	{ name: "Border", token: "--tnd-color-border" },
	{ name: "Ext (purple)", token: "--tnd-color-ext" },
	{ name: "Info", token: "--tnd-color-info" },
];

const SPACING = [1, 2, 3, 4, 5, 6, 7, 8];
const CHIP_TONES: ChipTone[] = [
	"neutral",
	"brand",
	"success",
	"warning",
	"danger",
	"info",
	"ext",
	"accent",
];
const BADGE_TONES: BadgeTone[] = [
	"neutral",
	"brand",
	"success",
	"warning",
	"danger",
	"info",
	"ext",
	"accent",
	"ink",
];
const STATUSES = [
	WorkItemStatus.Todo,
	WorkItemStatus.InProgress,
	WorkItemStatus.Blocked,
	WorkItemStatus.Done,
	WorkItemStatus.Cancelled,
];

/** A few demo rows for the "tables" component-catalog entry — same table style as
 * the Time screen's timesheet/team-report tables (`.tnd-teamreport`). */
const TABLE_ROWS: Array<{ id: string; owner: string; status: WorkItemStatus; points: number }> = [
	{ id: "AUR-119", owner: "Mira Lindqvist", status: WorkItemStatus.InProgress, points: 3 },
	{ id: "AUR-120", owner: "Aleks Novak", status: WorkItemStatus.Todo, points: 5 },
	{ id: "AUR-121", owner: "Sena Okafor", status: WorkItemStatus.Blocked, points: 2 },
	{ id: "AUR-122", owner: "Priya Iyer", status: WorkItemStatus.Done, points: 8 },
];

/** Tab ids for the "tabs" component-catalog entry, reusing the project-nav labels
 * (`nav.project.*`) so the demo tabs read as real section names. */
const TABS_DEMO_IDS = ["overview", "backlog", "board", "sprints"] as const;

/** A single logo-concept card in the 01 logo section: name, optional "Selected"
 * badge, and a boxed preview of the mark. */
function LogoConceptCard({
	name,
	selected,
	selectedLabel,
	children,
}: {
	name: string;
	selected?: boolean;
	selectedLabel?: string;
	children: ReactNode;
}) {
	return (
		<Card
			padded
			className="tnd-stack"
			style={selected ? { borderColor: "var(--tnd-color-brand)" } : undefined}
		>
			<div className="tnd-row tnd-row--between">
				<span style={{ fontWeight: 700 }}>{name}</span>
				{selected ? <Badge tone="brand">{selectedLabel}</Badge> : null}
			</div>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "4.5rem",
					background: "var(--tnd-color-surface-sunken)",
					borderRadius: "var(--tnd-radius-md)",
				}}
			>
				{children}
			</div>
		</Card>
	);
}

/** Decorative placeholder marks for the two rejected logo directions — schematic
 * shapes only (no real brand asset), so they read as distinct explorations next
 * to the chosen Horizon Stack mark. */
function LogoPlaceholderMark({
	variant,
	size = 32,
}: {
	variant: "compass" | "peak";
	size?: number;
}) {
	const r = size * 0.27;
	return (
		<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flex: "none" }}>
			<rect x={0} y={0} width={32} height={32} rx={r} fill="var(--tnd-color-mint-100)" />
			{variant === "compass" ? (
				<>
					<circle
						cx={16}
						cy={16}
						r={9}
						fill="none"
						stroke="var(--tnd-color-mint-600)"
						strokeWidth={1.85}
					/>
					<path d="M16 8.5 19 16l-3 7.5-3-7.5z" fill="var(--tnd-color-orange-400)" />
				</>
			) : (
				<>
					<path
						d="M6 22 12 12l4 5.5 3-4L26 22z"
						fill="none"
						stroke="var(--tnd-color-mint-600)"
						strokeWidth={1.85}
						strokeLinejoin="round"
					/>
					<circle cx={22} cy={10} r={2} fill="var(--tnd-color-orange-400)" />
				</>
			)}
		</svg>
	);
}

/** A single desktop/tablet/mobile mockup in the 06 responsiveness section: a
 * schematic nav diagram (sidebar/rail/tab-bar) plus a labelled description. */
function ResponsiveMock({
	kind,
	range,
	label,
	description,
}: {
	kind: "desktop" | "tablet" | "mobile";
	range: string;
	label: string;
	description: string;
}) {
	return (
		<Card padded className="tnd-stack">
			<div className="tnd-row tnd-row--between">
				<span style={{ fontWeight: 700 }}>{label}</span>
				<span className="tnd-mono tnd-subtle">{range}</span>
			</div>
			<div
				aria-hidden="true"
				style={{
					display: "flex",
					flexDirection: kind === "mobile" ? "column-reverse" : "row",
					gap: 2,
					height: "3.5rem",
					background: "var(--tnd-color-surface-sunken)",
					borderRadius: "var(--tnd-radius-md)",
					overflow: "hidden",
					padding: 4,
				}}
			>
				{kind === "mobile" ? (
					<span
						style={{
							display: "flex",
							gap: 6,
							justifyContent: "center",
							alignItems: "center",
							height: "0.9rem",
						}}
					>
						{[0, 1, 2, 3].map((i) => (
							<span
								key={i}
								style={{
									width: "0.55rem",
									height: "0.55rem",
									borderRadius: "999px",
									background: "var(--tnd-color-brand)",
								}}
							/>
						))}
					</span>
				) : (
					<span
						style={{
							display: "flex",
							flexDirection: "column",
							gap: 4,
							width: kind === "desktop" ? "34%" : "16%",
							background: "var(--tnd-color-brand-soft)",
							borderRadius: "var(--tnd-radius-sm)",
							padding: 4,
						}}
					>
						{[0, 1, 2, 3].map((i) => (
							<span
								key={i}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 4,
									height: "0.5rem",
								}}
							>
								<span
									style={{
										width: "0.5rem",
										height: "0.5rem",
										borderRadius: "999px",
										background: "var(--tnd-color-brand)",
										flex: "none",
									}}
								/>
								{kind === "desktop" ? (
									<span
										style={{
											height: "0.25rem",
											flex: 1,
											borderRadius: "999px",
											background: "var(--tnd-color-brand)",
											opacity: 0.5,
										}}
									/>
								) : null}
							</span>
						))}
					</span>
				)}
				<span
					style={{
						flex: 1,
						background: "var(--tnd-color-surface)",
						borderRadius: "var(--tnd-radius-sm)",
					}}
				/>
			</div>
			<p className="tnd-subtle" style={{ margin: 0 }}>
				{description}
			</p>
		</Card>
	);
}

/**
 * The design-system showcase (`/design-system`): tokens (colors, spacing), type,
 * the icon set, buttons, inputs/toggles, cards, badges/chips, status colors, a
 * module card, an extension slot, an empty state, and a live Drawer. Proves the
 * brand and the kit in one place.
 */
export function DesignSystemPage() {
	const { t } = useTranslation();
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [toggle, setToggle] = useState(true);
	const [activeTab, setActiveTab] = useState<string>(TABS_DEMO_IDS[0]);

	return (
		<div className="tnd-page">
			<PageHeader
				kicker={t("designSystem.kicker")}
				title={t("designSystem.title")}
				lead={t("designSystem.lead")}
			/>

			<Section title={t("designSystem.logo")} hint={t("designSystem.logoConceptsHint")}>
				<div className="tnd-grid tnd-grid--cards">
					<LogoConceptCard
						name={t("designSystem.logoConceptA")}
						selected
						selectedLabel={t("designSystem.logoSelected")}
					>
						<Logo size={32} title="Tundra 32" />
					</LogoConceptCard>
					<LogoConceptCard name={t("designSystem.logoConceptB")}>
						<LogoPlaceholderMark variant="compass" />
					</LogoConceptCard>
					<LogoConceptCard name={t("designSystem.logoConceptC")}>
						<LogoPlaceholderMark variant="peak" />
					</LogoConceptCard>
				</div>
				<Card padded style={{ marginTop: "var(--tnd-space-4)" }}>
					<div className="tnd-row" style={{ gap: "var(--tnd-space-5)" }}>
						<Logo size={16} title="Tundra 16" />
						<Logo size={28} title="Tundra 28" />
						<Logo size={32} title="Tundra 32" />
						<Logo size={48} title="Tundra 48" />
						<span className="tnd-mono tnd-subtle">16 · 28 · 32 · 48 — Horizon Stack</span>
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.colors")}>
				<div className="tnd-swatches">
					{COLOR_SWATCHES.map((s) => (
						<div className="tnd-swatch" key={s.token}>
							<div className="tnd-swatch__chip" style={{ background: `var(${s.token})` }} />
							<div className="tnd-swatch__meta">
								<div className="tnd-swatch__name">{s.name}</div>
								<div className="tnd-swatch__val">{s.token}</div>
							</div>
						</div>
					))}
				</div>
			</Section>

			<Section title={t("designSystem.typeScale")}>
				<Card padded className="tnd-stack">
					<span style={{ fontSize: "var(--tnd-text-3xl)", fontWeight: 800, letterSpacing: "-1px" }}>
						Display 30 / 800
					</span>
					<span style={{ fontSize: "var(--tnd-text-2xl)", fontWeight: 800 }}>
						Page title 28 / 800
					</span>
					<span style={{ fontSize: "var(--tnd-text-xl)", fontWeight: 700 }}>Section 22 / 700</span>
					<span style={{ fontSize: "var(--tnd-text-lg)", fontWeight: 700 }}>
						Card title 18 / 700
					</span>
					<span style={{ fontSize: "var(--tnd-text-md)" }}>Body 16 / 400</span>
					<span className="tnd-mono">Roboto Mono · AUR-119 · 8 pts · v2.4.0</span>
					<span className="tnd-kicker">Kicker · uppercase mono</span>
				</Card>
			</Section>

			<Section title={t("designSystem.spacingScale")}>
				<Card padded>
					<div className="tnd-row" style={{ alignItems: "flex-end" }}>
						{SPACING.map((n) => (
							<div key={n} style={{ textAlign: "center" }}>
								<div
									style={{
										width: `var(--tnd-space-${n})`,
										height: `var(--tnd-space-${n})`,
										background: "var(--tnd-color-brand-bright)",
										borderRadius: "var(--tnd-radius-sm)",
									}}
								/>
								<div className="tnd-swatch__val">{n}</div>
							</div>
						))}
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.buttons")}>
				<Card padded>
					<div className="tnd-row">
						<Button variant="primary">Primary</Button>
						<Button variant="accent">Accent CTA</Button>
						<Button variant="secondary">Secondary</Button>
						<Button variant="ghost">Ghost</Button>
						<Button variant="primary" disabled>
							Disabled
						</Button>
						<Button variant="secondary" leadingIcon={<Icon name="plus" size={16} />}>
							With icon
						</Button>
						<IconButton label="Notifications" hasDot>
							<Icon name="bell" />
						</IconButton>
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.inputsSwitches")}>
				<Card padded>
					<div className="tnd-row" style={{ gap: "var(--tnd-space-5)" }}>
						<Toggle checked={toggle} label={t("designSystem.demoSwitch")} onChange={setToggle} />
						<span className="tnd-subtle">role=switch · {toggle ? "on" : "off"}</span>
						<button type="button" className="tnd-topbar__search" style={{ maxWidth: "20rem" }}>
							<Icon name="search" size={16} aria-hidden /> {t("designSystem.search")}
						</button>
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.badgesChips")}>
				<Card padded className="tnd-stack">
					<div className="tnd-row">
						{BADGE_TONES.map((t) => (
							<Badge key={t} tone={t}>
								{t}
							</Badge>
						))}
					</div>
					<div className="tnd-row">
						{CHIP_TONES.map((t) => (
							<Chip key={t} tone={t}>
								{t}
							</Chip>
						))}
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.statusColors")}>
				<Card padded>
					<div className="tnd-row" style={{ gap: "var(--tnd-space-5)" }}>
						{STATUSES.map((s) => (
							<span key={s} className="tnd-row" style={{ gap: "var(--tnd-space-2)" }}>
								<StatusDot status={s} withLabel={false} label={statusText(t, s)} />
								<span className="tnd-subtle">{statusText(t, s)}</span>
							</span>
						))}
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.avatarsSkeletons")}>
				<Card padded>
					<div className="tnd-row" style={{ gap: "var(--tnd-space-5)" }}>
						<Avatar name="Mira Lindqvist" size="sm" />
						<Avatar name="Aleks Novak" />
						<Avatar name="Sena Okafor" size="lg" />
						<Skeleton variant="circle" width={36} height={36} />
						<Skeleton variant="text" width={140} />
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.tables")}>
				<Card padded>
					<div className="tnd-table-scroll">
						<table className="tnd-teamreport">
							<thead>
								<tr>
									<th scope="col">{t("designSystem.tablesTask")}</th>
									<th scope="col">{t("designSystem.tablesOwner")}</th>
									<th scope="col">{t("designSystem.tablesStatus")}</th>
									<th scope="col">{t("designSystem.tablesPoints")}</th>
								</tr>
							</thead>
							<tbody>
								{TABLE_ROWS.map((row) => (
									<tr key={row.id}>
										<td className="tnd-teamreport__person tnd-mono">{row.id}</td>
										<td>{row.owner}</td>
										<td>
											<span
												className="tnd-row"
												style={{ gap: "var(--tnd-space-2)", justifyContent: "flex-end" }}
											>
												<StatusDot status={row.status} withLabel={false} />
												{statusText(t, row.status)}
											</span>
										</td>
										<td>{row.points}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</Card>
			</Section>

			<Section title={t("designSystem.tabs")}>
				<Card padded className="tnd-stack">
					<Tabs
						items={TABS_DEMO_IDS.map((id) => ({ id, label: t(`nav.project.${id}` as never) }))}
						activeId={activeTab}
						onSelect={setActiveTab}
						aria-label={t("designSystem.tabsAriaLabel")}
					/>
					<p className="tnd-subtle" style={{ margin: 0 }}>
						{t("designSystem.tabsHint")}
					</p>
				</Card>
			</Section>

			<Section title={t("designSystem.moduleCardSlot")}>
				<div className="tnd-grid tnd-grid--two">
					<ModuleCard
						name="Kanban Board"
						meta="Workflow · v2.4.0"
						description="Drag-and-drop board with columns, swimlanes and WIP limits."
						status="Enabled"
						icon={<Icon name="columns" size={20} />}
						enabled
						onToggle={() => undefined}
					/>
					<ul className="tnd-extregistry__grid" style={{ gridTemplateColumns: "1fr" }}>
						<ExtensionSlot
							slot={{
								id: "ds-slot",
								name: "Task drawer",
								slotId: "task.drawer.panel",
								description: "Extra panels on any task.",
								contributing: 5,
								icon: <Icon name="checkSquare" size={18} />,
							}}
						/>
					</ul>
				</div>
			</Section>

			<Section title={t("designSystem.emptyStateDrawer")}>
				<div className="tnd-grid tnd-grid--two">
					<EmptyState
						icon={<Icon name="docs" size={22} />}
						title={t("designSystem.emptyTitle")}
						description={t("designSystem.emptyDescription")}
						action={<Button variant="accent">{t("designSystem.createOne")}</Button>}
					/>
					<Card padded className="tnd-stack">
						<p className="tnd-subtle" style={{ margin: 0 }}>
							{t("designSystem.drawerHint")}
						</p>
						<Button variant="secondary" onClick={() => setDrawerOpen(true)}>
							{t("designSystem.openDrawer")}
						</Button>
					</Card>
				</div>
				<Drawer
					open={drawerOpen}
					onClose={() => setDrawerOpen(false)}
					closeLabel={t("shell.drawerClose")}
					title={t("designSystem.drawerExampleTitle")}
					subtitle={t("designSystem.drawerExampleSubtitle")}
					topMeta={<Badge tone="brand">{t("designSystem.drawerDemo")}</Badge>}
				>
					<CardSection>{t("designSystem.drawerBody")}</CardSection>
				</Drawer>
			</Section>

			<Section title={t("designSystem.responsiveness")} hint={t("designSystem.responsiveHint")}>
				<div className="tnd-grid tnd-grid--cards">
					<ResponsiveMock
						kind="desktop"
						range="> 1024px"
						label={t("designSystem.responsiveDesktopLabel")}
						description={t("designSystem.responsiveDesktopDesc")}
					/>
					<ResponsiveMock
						kind="tablet"
						range="≤ 1024px"
						label={t("designSystem.responsiveTabletLabel")}
						description={t("designSystem.responsiveTabletDesc")}
					/>
					<ResponsiveMock
						kind="mobile"
						range="≤ 680px"
						label={t("designSystem.responsiveMobileLabel")}
						description={t("designSystem.responsiveMobileDesc")}
					/>
				</div>
			</Section>

			<Section title={t("designSystem.iaAcceptance")} hint={t("designSystem.iaAcceptanceHint")}>
				<Card padded>
					<ul className="tnd-list-reset tnd-stack" aria-label={t("designSystem.iaAcceptance")}>
						{(
							t("designSystem.iaAcceptanceItems", {
								returnObjects: true,
								defaultValue: [],
							}) as string[]
						).map((item, i) => (
							<li key={i} className="tnd-row" style={{ gap: "var(--tnd-space-3)" }}>
								<Icon
									name="check"
									size={18}
									aria-hidden
									style={{ color: "var(--tnd-color-brand)", flex: "none" }}
								/>
								<span>{item}</span>
							</li>
						))}
					</ul>
				</Card>
			</Section>

			<Section
				title={t("designSystem.iconSet")}
				hint={t("designSystem.iconCount", { count: ICON_NAMES.length })}
			>
				<div className="tnd-icongrid">
					{ICON_NAMES.map((name) => (
						<div className="tnd-icongrid__cell" key={name}>
							<Icon name={name} size={20} />
							<span className="tnd-icongrid__name">{name}</span>
						</div>
					))}
				</div>
			</Section>
		</div>
	);
}
