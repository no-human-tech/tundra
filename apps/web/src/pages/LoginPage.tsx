import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { Button, Icon, Logo, ThemeToggle, Toggle } from "@tundra/ui";

import { useAuth } from "../auth/AuthContext.js";
import { LanguageSwitcher } from "../components/LanguageSwitcher.js";

/**
 * Self-serve registration is closed — new accounts come from an admin invite,
 * SSO, or the separate "create a new workspace" flow (`#companysetup`, unaffected).
 * The design spec §7.2: "Rejestracja może być wyłączona (ekran „rejestracja
 * niedostępna" z ikoną kłódki)." `#register` still resolves (deep-link safe) but
 * renders the closed-state card below instead of a create-account form.
 */
type FormMode = "login" | "register" | "forgot" | "companysetup";
type PlanChoice = "community" | "team" | "enterprise";

interface FieldError {
	field?: "email" | "password" | "form";
	message: string;
}

const HASH_TO_MODE: Record<string, FormMode> = {
	"#login": "login",
	"#register": "register",
	"#forgot": "forgot",
	"#companysetup": "companysetup",
	"#entry": "login",
};

function hashToMode(hash: string): FormMode {
	return HASH_TO_MODE[hash] ?? "login";
}

function mapError(code: string, mode: FormMode): FieldError {
	if (code === "invalid_credentials") {
		return { field: "form", message: "auth.login.errorInvalidCredentials" };
	}
	if (code === "email_taken" || code === "Conflict") {
		return { field: "email", message: `auth.${mode}.errorEmailTaken` };
	}
	if (code === "password_too_short") {
		return { field: "password", message: `auth.${mode}.errorPasswordTooShort` };
	}
	if (code === "missing_fields") {
		return { field: "form", message: `auth.${mode}.errorGeneric` };
	}
	if (code === "provider_not_configured") {
		return { field: "form", message: "auth.github.errorProviderNotConfigured" };
	}
	if (code === "oauth_state_invalid" || code === "already_used") {
		return { field: "form", message: "auth.github.errorOauthStateInvalid" };
	}
	if (code === "oauth_exchange_failed") {
		return { field: "form", message: "auth.github.errorOauthExchangeFailed" };
	}
	if (code === "oauth_profile_unavailable") {
		return { field: "form", message: "auth.github.errorOauthProfileUnavailable" };
	}
	if (code === "email_conflict") {
		return { field: "form", message: "auth.github.errorEmailConflict" };
	}
	if (code === "identity_conflict") {
		return { field: "form", message: "auth.github.errorIdentityConflict" };
	}
	if (code === "sso_failed") {
		return { field: "form", message: "auth.sso.errorFailed" };
	}
	return { field: "form", message: `auth.${mode}.errorGeneric` };
}

function GitHubIcon() {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<path d="M12 0C5.37 0 0 5.373 0 12c0 5.303 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.84 1.237 1.84 1.237 1.07 1.834 2.807 1.304 3.492.997.108-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.93 0-1.31.468-2.38 1.235-3.22-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.3 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.22 0 4.61-2.807 5.625-5.479 5.92.43.372.823 1.102.823 2.222 0 1.604-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
		</svg>
	);
}

function GitLabIcon() {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			width="20"
			height="20"
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<path d="M12 21.4 3.6 14.9 2 9.8 5.6 2l2 6.9h8.8L18.4 2 22 9.8l-1.6 5.1L12 21.4z" />
		</svg>
	);
}

function GoogleIcon() {
	return (
		<svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24">
			<path
				fill="#4285F4"
				d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.7-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
			/>
			<path
				fill="#34A853"
				d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1C3.4 21.3 7.4 24 12 24z"
			/>
			<path
				fill="#FBBC05"
				d="M5.4 14.4c-.2-.7-.4-1.4-.4-2.4s.1-1.7.4-2.4V6.5H1.4C.5 8.2 0 10 0 12s.5 3.8 1.4 5.5l4-3.1z"
			/>
			<path
				fill="#EA4335"
				d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C17.9 1.2 15.2 0 12 0 7.4 0 3.4 2.7 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"
			/>
		</svg>
	);
}

function AppleIcon() {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="currentColor"
		>
			<path d="M16.7 1c.1 1.2-.4 2.4-1.1 3.3-.8.9-2 1.6-3.2 1.5-.1-1.2.5-2.5 1.2-3.3C14.4 1.6 15.6 1 16.7 1zM20.9 17.2c-.5 1.2-.8 1.7-1.5 2.8-1 1.5-2.3 3.3-4 3.3-1.5 0-1.9-.9-3.9-.9s-2.5.9-4 1c-1.6.1-2.8-1.6-3.8-3.1-2.1-3-3.7-8.5-1.5-12.2 1.1-1.8 3-3 5-3 1.5 0 2.9 1 3.9 1s2.7-1.2 4.5-1c.8.1 3 .3 4.4 2.4-.1.1-2.6 1.5-2.6 4.6.1 3.7 3.2 4.9 3.5 5.1z" />
		</svg>
	);
}

/**
 * OAuth sign-in tiles shown above the divider on the login card — one tile per
 * CONFIGURED provider only (the design spec's "provider visible only if configured"
 * contract). Only `/auth/github/start` exists server-side today (see
 * apps/api/src/index.ts); GitLab/Google/Apple follow the same
 * `${apiBase}/auth/<id>/start` convention and light up automatically the day
 * their client id + backend route exist, without any frontend change.
 */
interface OAuthProvider {
	id: "github" | "gitlab" | "google" | "apple";
	label: string;
	icon: ReactNode;
}

function useConfiguredOAuthProviders(apiBase: string): Array<OAuthProvider & { startUrl: string }> {
	const env = import.meta.env as Record<string, string | undefined>;
	const candidates: OAuthProvider[] = [
		{ id: "github", label: "GitHub", icon: <GitHubIcon /> },
		{ id: "gitlab", label: "GitLab", icon: <GitLabIcon /> },
		{ id: "google", label: "Google", icon: <GoogleIcon /> },
		{ id: "apple", label: "Apple", icon: <AppleIcon /> },
	];
	return candidates
		.filter((p) => !!env[`VITE_${p.id.toUpperCase()}_CLIENT_ID`])
		.map((p) => ({ ...p, startUrl: `${apiBase}/auth/${p.id}/start` }));
}

/**
 * OAuth providers offered on the company-setup screen (the design spec
 * §7.3): a checkbox per provider an admin may enable for their new workspace.
 * Unlike `useConfiguredOAuthProviders` (which only shows already-configured
 * providers on the sign-in card), this list is the full catalog — enabling one
 * here is a workspace-creation decision, not a live sign-in option yet.
 */
const COMPANY_OAUTH_PROVIDERS: OAuthProvider[] = [
	{ id: "github", label: "GitHub", icon: <GitHubIcon /> },
	{ id: "gitlab", label: "GitLab", icon: <GitLabIcon /> },
	{ id: "google", label: "Google", icon: <GoogleIcon /> },
	{ id: "apple", label: "Apple", icon: <AppleIcon /> },
];

export function LoginPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const location = useLocation();
	const { status, login } = useAuth();

	const [mode, setMode] = useState<FormMode>(() => hashToMode(location.hash));

	// Form fields – login
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState<FieldError | null>(null);
	const [busy, setBusy] = useState(false);

	const apiBase = (
		(import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:4000/graphql"
	).replace(/\/graphql$/, "");
	const oauthProviders = useConfiguredOAuthProviders(apiBase);
	// Central SSO (OIDC, e.g. Keycloak). Baked at build time like the OAuth
	// client ids: the tile only appears when the deployment enables it.
	const oidcSsoEnabled = (import.meta.env.VITE_OIDC_ENABLED as string | undefined) === "true";

	// Forgot-password fields
	const [forgotEmail, setForgotEmail] = useState("");
	const [forgotSent, setForgotSent] = useState(false);

	// Company-setup fields
	const [orgName, setOrgName] = useState("");
	const [orgUrl, setOrgUrl] = useState("");
	const [plan, setPlan] = useState<PlanChoice>("community");
	const [logoPreview, setLogoPreview] = useState<string | null>(null);
	const logoInputRef = useRef<HTMLInputElement>(null);
	const [ssoEnabled, setSsoEnabled] = useState(false);
	const [ssoRealm, setSsoRealm] = useState("");
	const [ssoKdc, setSsoKdc] = useState("");
	const [oauthEnabled, setOauthEnabled] = useState<Record<string, boolean>>({});
	const [oauthOrgName, setOauthOrgName] = useState("");
	const [emailEnabled, setEmailEnabled] = useState(true);

	// Sync mode from hash (handles programmatic navigation AND browser back/forward).
	useEffect(() => {
		setMode(hashToMode(location.hash));
		setError(null);
	}, [location.hash]);

	// Redirect once authenticated (skip for companysetup which goes to /dashboard directly).
	useEffect(() => {
		if (status === "authenticated" && mode !== "companysetup") {
			void navigate("/dashboard");
		}
	}, [status, navigate, mode]);

	// Handle OAuth error codes passed back from the API callback redirect.
	useEffect(() => {
		const params = new URLSearchParams(location.search);
		const code = params.get("error");
		if (code) {
			setError(mapError(code, "login"));
		}
	}, []); // intentionally runs once on mount

	const switchMode = (next: FormMode) => {
		void navigate(`/login#${next}`, { replace: true });
	};

	// ── Login submit ──────────────────────────────────────────────────────────

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError(null);
		setBusy(true);
		try {
			const result = await login(email, password);
			if (result.error) {
				setError(mapError(result.error, "login"));
			}
		} finally {
			setBusy(false);
		}
	};

	// ── Forgot-password submit ───────────────────────────────────────────────

	const handleForgotSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		// TODO: wire to API when the password-reset endpoint exists.
		setForgotSent(true);
	};

	// ── Company-setup submit ─────────────────────────────────────────────────

	const handleSetupSubmit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		// TODO: wire to API when the workspace-creation endpoint exists.
		void navigate("/dashboard");
	};

	const handleLogoChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => setLogoPreview(typeof reader.result === "string" ? reader.result : null);
		reader.readAsDataURL(file);
	};

	const toggleOauthProvider = (id: string) => {
		setOauthEnabled((s) => ({ ...s, [id]: !s[id] }));
	};

	// ── Shared shell ─────────────────────────────────────────────────────────
	// Header carries brand (left) + theme/language controls (right) only, on
	// every auth mode (the design prototype's isAuth header carries nothing else).

	return (
		<div className="tnd-auth">
			<a className="tnd-skip-link" href="#tnd-auth-main">
				{t("shell.skipLink")}
			</a>
			<header className="tnd-auth__bar">
				<Link to="/" className="tnd-auth__bar-brand">
					<Logo size={48} title="Tundra" />
					<span className="tnd-auth__wordmark">Tundra</span>
				</Link>
				<div className="tnd-auth__bar-actions">
					<LanguageSwitcher />
					<ThemeToggle
						labelSwitchToDark={t("theme.switchToDark")}
						labelSwitchToLight={t("theme.switchToLight")}
						size="sm"
					/>
				</div>
			</header>

			<main id="tnd-auth-main" className="tnd-auth__main">
				{/* ── LOGIN ──────────────────────────────────────────────── */}
				{mode === "login" && (
					<div className="tnd-auth__card">
						<h1 id="tnd-page-title" className="tnd-auth__title" tabIndex={-1}>
							{t("auth.login.title")}
						</h1>
						<p className="tnd-auth__lead">{t("auth.login.subtitle")}</p>

						{error?.field === "form" ? (
							<p className="tnd-auth__error" role="alert">
								{t(error.message as never)}
							</p>
						) : null}

						{oidcSsoEnabled ? (
							<Button
								type="button"
								variant="accent"
								style={{ width: "100%" }}
								onClick={() => {
									window.location.href = `${apiBase}/auth/oidc/start`;
								}}
							>
								{t("auth.sso.continueWith")}
							</Button>
						) : null}

						{oauthProviders.length > 0 ? (
							<div
								className="tnd-oauth-row"
								role="group"
								aria-label={t("auth.login.providersLabel")}
							>
								{oauthProviders.map((p) => (
									<a
										key={p.id}
										href={p.startUrl}
										className="tnd-oauth-tile"
										rel="noopener noreferrer"
										title={p.label}
										aria-label={t("auth.login.providerAria", { provider: p.label })}
									>
										{p.icon}
									</a>
								))}
							</div>
						) : null}

						{oauthProviders.length > 0 || oidcSsoEnabled ? (
							<div className="tnd-auth__divider" aria-hidden="true">
								<span>{t("auth.login.orEmail")}</span>
							</div>
						) : null}

						<form className="tnd-auth__form" onSubmit={(e) => void handleSubmit(e)} noValidate>
							<label className="tnd-field">
								<span className="tnd-field__label">{t("auth.login.emailLabel")}</span>
								<input
									className="tnd-field__input"
									type="email"
									name="email"
									autoComplete="email"
									placeholder={t("auth.login.emailPlaceholder")}
									required
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
								{error?.field === "email" ? (
									<span className="tnd-field__error" role="alert">
										{t(error.message as never)}
									</span>
								) : null}
							</label>

							<div className="tnd-field">
								<div className="tnd-field__row">
									<span className="tnd-field__label">{t("auth.login.passwordLabel")}</span>
									<button
										type="button"
										className="tnd-link tnd-field__forgot"
										onClick={() => switchMode("forgot")}
									>
										{t("auth.login.forgotLink")}
									</button>
								</div>
								<div className="tnd-field__password">
									<input
										className="tnd-field__input"
										type={showPassword ? "text" : "password"}
										name="password"
										autoComplete="current-password"
										placeholder={t("auth.login.passwordPlaceholder")}
										required
										value={password}
										onChange={(e) => setPassword(e.target.value)}
									/>
									<button
										type="button"
										className="tnd-field__reveal"
										onClick={() => setShowPassword((v) => !v)}
										aria-label={
											showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")
										}
										title={
											showPassword ? t("auth.login.hidePassword") : t("auth.login.showPassword")
										}
									>
										<Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
									</button>
								</div>
								{error?.field === "password" ? (
									<span className="tnd-field__error" role="alert">
										{t(error.message as never)}
									</span>
								) : null}
							</div>

							<Button type="submit" variant="accent" disabled={busy} style={{ width: "100%" }}>
								{t("auth.login.submit")}
							</Button>
						</form>

						<p className="tnd-auth__toggle">
							{t("auth.login.noAccount")}{" "}
							<button type="button" className="tnd-link" onClick={() => switchMode("register")}>
								{t("auth.login.createAccount")}
							</button>
						</p>
					</div>
				)}

				{/* ── REGISTER (closed) ──────────────────────────────────── */}
				{mode === "register" && (
					<div className="tnd-auth__card" style={{ textAlign: "center" }}>
						<div
							aria-hidden="true"
							style={{
								width: 54,
								height: 54,
								borderRadius: 14,
								background: "#FFF1E7",
								color: "#F2722B",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								margin: "0 auto 18px",
							}}
						>
							<Icon name="lock" size={24} />
						</div>
						<h1 id="tnd-page-title" className="tnd-auth__title" tabIndex={-1}>
							{t("auth.register.closedTitle")}
						</h1>
						<p className="tnd-auth__lead">{t("auth.register.closedLead")}</p>
						<Button
							type="button"
							variant="accent"
							style={{ width: "100%" }}
							onClick={() => switchMode("login")}
						>
							{t("auth.register.closedCta")}
						</Button>{" "}
					</div>
				)}

				{/* ── FORGOT PASSWORD ─────────────────────────────────────── */}
				{mode === "forgot" && (
					<div className="tnd-auth__card">
						<p className="tnd-kicker">{t("auth.forgot.kicker")}</p>
						<h1 id="tnd-page-title" className="tnd-auth__title" tabIndex={-1}>
							{t("auth.forgot.title")}
						</h1>
						<p className="tnd-auth__lead">{t("auth.forgot.lead")}</p>
						{forgotSent ? (
							<p className="tnd-auth__success" role="status">
								Check your inbox — a reset link is on its way.
							</p>
						) : (
							<form className="tnd-auth__form" onSubmit={handleForgotSubmit} noValidate>
								<label className="tnd-field">
									<span className="tnd-field__label">{t("auth.forgot.emailLabel")}</span>
									<input
										className="tnd-field__input"
										type="email"
										name="email"
										autoComplete="email"
										placeholder={t("auth.forgot.emailPlaceholder")}
										required
										value={forgotEmail}
										onChange={(e) => setForgotEmail(e.target.value)}
									/>
								</label>
								<Button type="submit" variant="accent" style={{ width: "100%" }}>
									{t("auth.forgot.submit")}
								</Button>
							</form>
						)}
						<p className="tnd-auth__toggle">
							<button type="button" className="tnd-link" onClick={() => switchMode("login")}>
								{t("auth.forgot.backToLogin")}
							</button>
						</p>{" "}
					</div>
				)}

				{/* ── COMPANY SETUP ───────────────────────────────────────── */}
				{mode === "companysetup" && (
					<div className="tnd-auth__card tnd-auth__card--wide">
						<div
							className="tnd-auth__step-indicator"
							aria-label={t("auth.companysetup.stepIndicator")}
						>
							<span className="tnd-auth__step tnd-auth__step--done" aria-hidden="true">
								1
							</span>
							<span className="tnd-auth__step-line" aria-hidden="true" />
							<span className="tnd-auth__step tnd-auth__step--active" aria-current="step">
								2
							</span>
							<span className="tnd-auth__step-label">{t("auth.companysetup.stepIndicator")}</span>
						</div>
						<p className="tnd-kicker">{t("auth.companysetup.kicker")}</p>
						<h1 id="tnd-page-title" className="tnd-auth__title" tabIndex={-1}>
							{t("auth.companysetup.title")}
						</h1>
						<p className="tnd-auth__lead">{t("auth.companysetup.lead")}</p>
						<form className="tnd-auth__form" onSubmit={handleSetupSubmit} noValidate>
							<div className="tnd-field tnd-logo-field">
								<span className="tnd-field__label">{t("auth.companysetup.orgNameLabel")}</span>
								<div className="tnd-logo-row">
									<input
										ref={logoInputRef}
										type="file"
										accept="image/*"
										className="tnd-sr-only"
										id="tnd-logo-upload"
										onChange={handleLogoChange}
									/>
									<button
										type="button"
										className="tnd-logo-placeholder"
										onClick={() => logoInputRef.current?.click()}
										aria-label={t("auth.companysetup.uploadLogo")}
										title={t("auth.companysetup.uploadLogo")}
									>
										{logoPreview ? (
											<img src={logoPreview} alt="" className="tnd-logo-placeholder__img" />
										) : (
											<Icon name="image" size={20} aria-hidden />
										)}
									</button>
									<div className="tnd-logo-row__fields">
										<input
											className="tnd-field__input"
											type="text"
											name="orgName"
											autoComplete="organization"
											placeholder={t("auth.companysetup.orgNamePlaceholder")}
											required
											value={orgName}
											onChange={(e) => setOrgName(e.target.value)}
										/>
										<button
											type="button"
											className="tnd-link tnd-logo-row__upload-link"
											onClick={() => logoInputRef.current?.click()}
										>
											{logoPreview
												? t("auth.companysetup.changeLogo")
												: t("auth.companysetup.uploadLogo")}
										</button>
									</div>
								</div>
							</div>

							<label className="tnd-field">
								<span className="tnd-field__label">{t("auth.companysetup.urlLabel")}</span>
								<div className="tnd-field__input-group">
									<span className="tnd-field__input-prefix">
										{t("auth.companysetup.urlPrefix")}
									</span>
									<input
										className="tnd-field__input tnd-field__input--joined"
										type="text"
										name="orgUrl"
										autoComplete="off"
										placeholder={t("auth.companysetup.urlPlaceholder")}
										required
										value={orgUrl}
										onChange={(e) =>
											setOrgUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
										}
									/>
								</div>
							</label>

							<fieldset className="tnd-field tnd-plan-picker">
								<legend className="tnd-field__label">{t("auth.companysetup.planLabel")}</legend>
								<div className="tnd-plan-picker__options">
									{(["community", "team", "enterprise"] as PlanChoice[]).map((p) => (
										<label
											key={p}
											className={`tnd-plan-picker__option${plan === p ? " tnd-plan-picker__option--selected" : ""}`}
										>
											<input
												type="radio"
												name="plan"
												value={p}
												checked={plan === p}
												onChange={() => setPlan(p)}
												className="tnd-plan-picker__radio"
											/>
											<span className="tnd-plan-picker__name">
												{p.charAt(0).toUpperCase() + p.slice(1)}
											</span>
											{p === "team" && <span className="tnd-plan-picker__badge">Popular</span>}
										</label>
									))}
								</div>
							</fieldset>

							<div className="tnd-field tnd-authmethods">
								<span className="tnd-field__label">{t("auth.companysetup.authMethodsLabel")}</span>

								<div className="tnd-authmethods__row">
									<div className="tnd-authmethods__row-head">
										<span className="tnd-authmethods__row-title">
											{t("auth.companysetup.ssoToggleLabel")}
										</span>
										<span className="tnd-authmethods__row-sub">
											{t("auth.companysetup.ssoToggleSub")}
										</span>
									</div>
									<Toggle
										checked={ssoEnabled}
										label={t("auth.companysetup.ssoToggleLabel")}
										onChange={setSsoEnabled}
									/>
								</div>
								{ssoEnabled && (
									<div className="tnd-authmethods__reveal">
										<label className="tnd-field">
											<span className="tnd-field__label">{t("auth.companysetup.realmLabel")}</span>
											<input
												className="tnd-field__input"
												type="text"
												name="ssoRealm"
												autoComplete="off"
												placeholder={t("auth.companysetup.realmPlaceholder")}
												value={ssoRealm}
												onChange={(e) => setSsoRealm(e.target.value)}
											/>
										</label>
										<label className="tnd-field">
											<span className="tnd-field__label">{t("auth.companysetup.kdcLabel")}</span>
											<input
												className="tnd-field__input"
												type="text"
												name="ssoKdc"
												autoComplete="off"
												placeholder={t("auth.companysetup.kdcPlaceholder")}
												value={ssoKdc}
												onChange={(e) => setSsoKdc(e.target.value)}
											/>
										</label>
									</div>
								)}

								<hr className="tnd-authmethods__divider" aria-hidden="true" />

								<fieldset className="tnd-authmethods__fieldset">
									<legend className="tnd-authmethods__row-title">
										{t("auth.companysetup.oauthLabel")}
									</legend>
									<div className="tnd-oauth-checklist">
										{COMPANY_OAUTH_PROVIDERS.map((p) => (
											<label key={p.id} className="tnd-oauth-checklist__option">
												<input
													type="checkbox"
													checked={!!oauthEnabled[p.id]}
													onChange={() => toggleOauthProvider(p.id)}
												/>
												{p.icon}
												<span>{p.label}</span>
											</label>
										))}
									</div>
									<label className="tnd-field">
										<span className="tnd-field__label">{t("auth.companysetup.oauthOrgLabel")}</span>
										<input
											className="tnd-field__input"
											type="text"
											name="oauthOrgName"
											autoComplete="off"
											placeholder={t("auth.companysetup.oauthOrgPlaceholder")}
											value={oauthOrgName}
											onChange={(e) => setOauthOrgName(e.target.value)}
										/>
									</label>
								</fieldset>

								<hr className="tnd-authmethods__divider" aria-hidden="true" />

								<div className="tnd-authmethods__row">
									<div className="tnd-authmethods__row-head">
										<span className="tnd-authmethods__row-title">
											{t("auth.companysetup.emailToggleLabel")}
										</span>
										<span className="tnd-authmethods__row-sub">
											{t("auth.companysetup.emailToggleSub")}
										</span>
									</div>
									<Toggle
										checked={emailEnabled}
										label={t("auth.companysetup.emailToggleLabel")}
										onChange={setEmailEnabled}
									/>
								</div>
							</div>

							<Button
								type="submit"
								variant="accent"
								style={{ width: "100%", background: "#FF8A3D", borderColor: "#FF8A3D" }}
							>
								{t("auth.companysetup.submit")}
							</Button>
						</form>
						<p className="tnd-auth__toggle">
							<button type="button" className="tnd-link" onClick={() => switchMode("login")}>
								{t("auth.forgot.backToLogin")}
							</button>
						</p>{" "}
					</div>
				)}
			</main>
		</div>
	);
}
