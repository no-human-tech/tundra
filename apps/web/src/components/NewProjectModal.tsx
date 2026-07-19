import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useTranslation } from "react-i18next";

import { Button, Icon, Modal } from "@tundra/ui";
import type { IconName } from "@tundra/ui";

import {
	ALL_PEOPLE,
	ME,
	MODULE_CATALOG,
	PROJECT_ROLE_I18N_KEY,
	PROJECT_ROLE_OPTIONS,
	DEFAULT_PROJECT_ROLE,
	type ProjectMethod,
	type ProjectRole,
	type SampleProject,
} from "../data/index.js";

import "./NewProjectModal.css";

/** Avatar swatches reference existing semantic tokens (never literal hex) so
 * the picker stays theme-consistent; the swatch itself carries no semantic
 * meaning beyond "pick an identity color", same rationale as
 * `--tnd-color-avatar-bg` in tokens.css. */
const AVATAR_SWATCH_TOKENS = [
	"--tnd-color-brand",
	"--tnd-color-accent-strong",
	"--tnd-color-info",
	"--tnd-color-ext",
	"--tnd-color-warning",
	"--tnd-color-danger",
] as const;

const METHOD_OPTIONS: { id: ProjectMethod; icon: IconName }[] = [
	{ id: "scrum", icon: "sprints" },
	{ id: "kanban", icon: "board" },
];

/** Modules pre-enabled for every new project — mirrors the catalog's own
 * "Enabled" defaults shown in the Extensions marketplace. Tasks Core is
 * locked (matches ModuleCard's `locked` semantics — required, can't disable). */
function defaultEnabledModules(): Record<string, boolean> {
	return Object.fromEntries(
		MODULE_CATALOG.map((m) => [m.id, Boolean(m.status === "Enabled" || m.locked)]),
	);
}

interface TeamRowState {
	included: boolean;
	role: ProjectRole;
}

function defaultTeamState(): Record<string, TeamRowState> {
	return Object.fromEntries(
		ALL_PEOPLE.map((p) => [p.id, { included: false, role: DEFAULT_PROJECT_ROLE }]),
	);
}

/** Two-letter initials derived from a project name, e.g. "Aurora Platform" -> "AP". */
function projectInitials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "N";
	if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase();
	return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** A short uppercase project key (badge shown on the /projects card), e.g. "Aurora Platform" -> "AUR". */
function projectKey(name: string): string {
	const letters = name.replace(/[^a-zA-Z]/g, "");
	return (letters.slice(0, 3) || "NEW").toUpperCase();
}

function slugify(name: string): string {
	const slug = name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/(^-+|-+$)/g, "");
	return slug || "project";
}

/** Generate a stable, unique id for a newly created project. */
function generateProjectId(name: string): string {
	const random = Math.random().toString(36).slice(2, 6);
	return `proj-${slugify(name)}-${Date.now().toString(36)}${random}`;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB

export interface NewProjectModalProps {
	open: boolean;
	onClose: () => void;
	onCreate: (project: SampleProject) => void;
}

/**
 * The "New project" modal — shared by all 4 entry points (topbar `+`, the
 * dashboard CTA, the Projects page CTA, and the Projects page dashed tile).
 * Client-only: on Create it builds a `SampleProject` and hands it to
 * `onCreate`; it never calls a backend. Cancel/overlay/Esc close it without
 * persisting anything (state resets the next time it opens).
 */
export function NewProjectModal({ open, onClose, onCreate }: NewProjectModalProps) {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const methodGroupId = useId();
	const modulesGroupId = useId();

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [repoUrl, setRepoUrl] = useState("");
	const [avatarImage, setAvatarImage] = useState<string | null>(null);
	const [avatarColorToken, setAvatarColorToken] = useState<string>(AVATAR_SWATCH_TOKENS[0]);
	const [avatarError, setAvatarError] = useState<string | null>(null);
	const [method, setMethod] = useState<ProjectMethod>("scrum");
	const [enabledModules, setEnabledModules] =
		useState<Record<string, boolean>>(defaultEnabledModules);
	const [team, setTeam] = useState<Record<string, TeamRowState>>(defaultTeamState);

	// Fresh form every time the modal opens; Cancel/close never persists.
	useEffect(() => {
		if (!open) return;
		setName("");
		setDescription("");
		setRepoUrl("");
		setAvatarImage(null);
		setAvatarColorToken(AVATAR_SWATCH_TOKENS[0]);
		setAvatarError(null);
		setMethod("scrum");
		setEnabledModules(defaultEnabledModules());
		setTeam(defaultTeamState());
		if (fileInputRef.current) fileInputRef.current.value = "";
	}, [open]);

	const hasProjectManager = Object.values(team).some(
		(row) => row.included && row.role === "Project Manager",
	);
	const canCreate = name.trim().length > 0 && hasProjectManager;

	function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			setAvatarError(t("newProject.avatarErrorInvalidType"));
			event.target.value = "";
			return;
		}
		if (file.size > MAX_AVATAR_BYTES) {
			setAvatarError(t("newProject.avatarErrorTooLarge"));
			event.target.value = "";
			return;
		}
		setAvatarError(null);
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === "string") {
				setAvatarImage(reader.result);
			}
		};
		reader.readAsDataURL(file);
	}

	function removeImage() {
		setAvatarImage(null);
		setAvatarError(null);
		if (fileInputRef.current) fileInputRef.current.value = "";
	}

	function toggleModule(id: string) {
		const entry = MODULE_CATALOG.find((m) => m.id === id);
		if (entry?.locked) return;
		setEnabledModules((prev) => ({ ...prev, [id]: !prev[id] }));
	}

	function toggleTeamInclude(personId: string) {
		setTeam((prev) => ({
			...prev,
			[personId]: { ...prev[personId]!, included: !prev[personId]!.included },
		}));
	}

	function setTeamRole(personId: string, role: ProjectRole) {
		setTeam((prev) => ({ ...prev, [personId]: { ...prev[personId]!, role } }));
	}

	function handleCreate() {
		if (!canCreate) return;
		const includedIds = Object.entries(team)
			.filter(([, row]) => row.included)
			.map(([id]) => id);
		const pmId = Object.entries(team).find(
			([, row]) => row.included && row.role === "Project Manager",
		)?.[0];
		const owner = ALL_PEOPLE.find((p) => p.id === pmId) ?? ME;
		const modules = MODULE_CATALOG.filter((m) => enabledModules[m.id]).map((m) => m.name);

		const project: SampleProject = {
			id: generateProjectId(name),
			key: projectKey(name),
			name: name.trim(),
			description: description.trim(),
			status: "Active",
			method,
			owner,
			updated: t("newProject.justNow"),
			progress: 0,
			openTasks: 0,
			memberCount: includedIds.length,
			modules,
		};
		onCreate(project);
	}

	return (
		<Modal
			open={open}
			onClose={onClose}
			title={t("newProject.title")}
			size="lg"
			closeLabel={t("shell.drawerClose")}
			footer={
				<>
					<Button variant="ghost" onClick={onClose}>
						{t("newProject.cancel")}
					</Button>
					<Button variant="accent" onClick={handleCreate} disabled={!canCreate}>
						{t("newProject.create")}
					</Button>
				</>
			}
		>
			<div className="tnd-newproject__grid">
				{/* LEFT: avatar + general details */}
				<div className="tnd-newproject__col">
					<p className="tnd-newproject__kicker">{t("newProject.avatarKicker")}</p>
					<div className="tnd-newproject__avatarrow">
						{avatarImage ? (
							<span
								className="tnd-newproject__avatarpreview"
								style={{ backgroundImage: `url(${avatarImage})` }}
								aria-hidden="true"
							/>
						) : (
							<span
								className="tnd-newproject__avatarpreview"
								style={{ background: `var(${avatarColorToken})` }}
								aria-hidden="true"
							>
								{name.trim() ? projectInitials(name) : "—"}
							</span>
						)}
						<div className="tnd-newproject__avataractions">
							<label className="tnd-newproject__uploadbtn">
								<Icon name="image" size={16} aria-hidden />
								{t("newProject.upload")}
								<input
									ref={fileInputRef}
									type="file"
									accept="image/*"
									onChange={handleFileChange}
									style={{ display: "none" }}
								/>
							</label>
							{avatarImage ? (
								<button type="button" className="tnd-newproject__removeimg" onClick={removeImage}>
									{t("newProject.removeImage")}
								</button>
							) : null}
						</div>
					</div>
					<p className="tnd-newproject__hint">{t("newProject.uploadHint")}</p>
					{avatarError ? (
						<p className="tnd-newproject__error" role="alert">
							{avatarError}
						</p>
					) : null}
					<div
						className="tnd-newproject__swatches"
						role="group"
						aria-label={t("newProject.avatarKicker")}
					>
						{AVATAR_SWATCH_TOKENS.map((token, i) => (
							<button
								key={token}
								type="button"
								className="tnd-newproject__swatch"
								aria-label={t("newProject.colorSwatchLabel", { index: i + 1 })}
								aria-pressed={!avatarImage && avatarColorToken === token}
								style={{
									background: `var(${token})`,
									outlineColor:
										!avatarImage && avatarColorToken === token ? `var(${token})` : "transparent",
								}}
								onClick={() => setAvatarColorToken(token)}
							/>
						))}
					</div>

					<div className="tnd-newproject__divider" />

					<p className="tnd-newproject__kicker">{t("newProject.generalKicker")}</p>
					<div className="tnd-newproject__field">
						<label className="tnd-newproject__label" htmlFor="np-name">
							{t("newProject.nameLabel")}
						</label>
						<input
							id="np-name"
							className="tnd-newproject__input"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={t("newProject.namePlaceholder")}
							required
						/>
					</div>
					<div className="tnd-newproject__field">
						<label className="tnd-newproject__label" htmlFor="np-desc">
							{t("newProject.descriptionLabel")}
						</label>
						<textarea
							id="np-desc"
							className="tnd-newproject__textarea"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder={t("newProject.descriptionPlaceholder")}
							rows={3}
						/>
					</div>
					<div className="tnd-newproject__field">
						<label className="tnd-newproject__label" htmlFor="np-repo">
							{t("newProject.repoLabel")}
						</label>
						<div className="tnd-newproject__repo">
							<Icon name="github" size={16} aria-hidden />
							<input
								id="np-repo"
								className="tnd-newproject__repoinput"
								value={repoUrl}
								onChange={(e) => setRepoUrl(e.target.value)}
								placeholder={t("newProject.repoPlaceholder")}
							/>
						</div>
					</div>
				</div>

				{/* RIGHT: methodology + modules */}
				<div className="tnd-newproject__col">
					<p className="tnd-newproject__kicker">{t("newProject.methodKicker")}</p>
					<p className="tnd-newproject__hint">{t("newProject.methodHint")}</p>
					<div
						className="tnd-newproject__cardlist"
						role="radiogroup"
						aria-label={t("newProject.methodKicker")}
						id={methodGroupId}
					>
						{METHOD_OPTIONS.map((option) => {
							const checked = method === option.id;
							return (
								<button
									key={option.id}
									type="button"
									role="radio"
									aria-checked={checked}
									className="tnd-newproject__card"
									data-checked={checked || undefined}
									onClick={() => setMethod(option.id)}
								>
									<span className="tnd-newproject__cardicon" aria-hidden="true">
										<Icon name={option.icon} size={16} />
									</span>
									<span className="tnd-newproject__cardmeta">
										<span className="tnd-newproject__cardlabel">
											{t(`newProject.method.${option.id}.label`)}
										</span>
										<span className="tnd-newproject__carddesc">
											{t(`newProject.method.${option.id}.description`)}
										</span>
									</span>
									<span className="tnd-newproject__radiodot" aria-hidden="true" />
								</button>
							);
						})}
					</div>

					<p className="tnd-newproject__kicker">{t("newProject.modulesKicker")}</p>
					<p className="tnd-newproject__hint">{t("newProject.modulesHint")}</p>
					<div
						className="tnd-newproject__cardlist tnd-newproject__cardlist--scroll"
						aria-label={t("newProject.modulesKicker")}
						id={modulesGroupId}
					>
						{MODULE_CATALOG.map((mod) => {
							const checked = Boolean(enabledModules[mod.id]);
							return (
								<button
									key={mod.id}
									type="button"
									role="switch"
									aria-checked={checked}
									className="tnd-newproject__card"
									data-checked={checked || undefined}
									disabled={mod.locked}
									onClick={() => toggleModule(mod.id)}
								>
									<span className="tnd-newproject__cardicon" aria-hidden="true">
										<Icon name={mod.icon} size={16} />
									</span>
									<span className="tnd-newproject__cardmeta">
										<span className="tnd-newproject__cardlabel">{mod.name}</span>
										<span className="tnd-newproject__carddesc">{mod.description}</span>
									</span>
									<span className="tnd-newproject__switchdot" aria-hidden="true">
										{checked ? <Icon name="check" size={12} /> : null}
									</span>
								</button>
							);
						})}
					</div>
				</div>
			</div>

			{/* TEAM — full width */}
			<div className="tnd-newproject__team">
				<p className="tnd-newproject__kicker">{t("newProject.teamKicker")}</p>
				<p className="tnd-newproject__hint">{t("newProject.teamHint")}</p>
				<div className="tnd-newproject__teamlist">
					{ALL_PEOPLE.map((person) => {
						const row = team[person.id] ?? { included: false, role: DEFAULT_PROJECT_ROLE };
						return (
							<div key={person.id} className="tnd-newproject__teamrow">
								<button
									type="button"
									role="checkbox"
									aria-checked={row.included}
									aria-label={t("newProject.teamIncludeLabel", { name: person.name })}
									className="tnd-newproject__checkbox"
									data-checked={row.included || undefined}
									onClick={() => toggleTeamInclude(person.id)}
								>
									{row.included ? <Icon name="check" size={13} /> : null}
								</button>
								<span
									className="tnd-newproject__memberavatar"
									aria-hidden="true"
									style={{ opacity: row.included ? 1 : 0.45 }}
								>
									{person.initials}
								</span>
								<span
									className="tnd-newproject__membername"
									style={{ opacity: row.included ? 1 : 0.45 }}
								>
									{person.name}
								</span>
								<select
									className="tnd-select tnd-newproject__roleselect"
									value={row.role}
									aria-label={t("newProject.roleSelectLabel", { name: person.name })}
									onChange={(e) => setTeamRole(person.id, e.target.value as ProjectRole)}
								>
									{PROJECT_ROLE_OPTIONS.map((role) => (
										<option key={role} value={role}>
											{t(PROJECT_ROLE_I18N_KEY[role] as never)}
										</option>
									))}
								</select>
							</div>
						);
					})}
				</div>
				{!hasProjectManager ? (
					<div className="tnd-newproject__warning" role="alert">
						<Icon name="alert" size={16} aria-hidden />
						<span>{t("newProject.pmRequired")}</span>
					</div>
				) : null}
			</div>
		</Modal>
	);
}
