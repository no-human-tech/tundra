import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Chip, Icon, Logo } from "@tundra/ui";

/**
 * App entry / Welcome (`/welcome`). The single screen that renders WITHOUT the
 * app shell — a calm mint hero with the brand, the value proposition, and the
 * primary actions: Open workspace (orange CTA → dashboard), Create project, and
 * Explore demo. Exactly one <h1> (focus anchor) per the a11y rules.
 */
export function WelcomePage() {
	const { t } = useTranslation();
	useEffect(() => {
		document.getElementById("tnd-page-title")?.focus();
	}, []);

	return (
		<div className="tnd-welcome">
			<a className="tnd-skip-link" href="#tnd-welcome-main">
				{t("welcome.skipLink")}
			</a>
			<header className="tnd-welcome__bar">
				<Logo size={32} title="Tundra" />
				<span className="tnd-welcome__wordmark">Tundra</span>
			</header>

			<main id="tnd-welcome-main" className="tnd-welcome__main">
				<div className="tnd-welcome__inner">
					<p className="tnd-kicker">{t("welcome.kicker")}</p>
					<h1 id="tnd-page-title" className="tnd-welcome__title" tabIndex={-1}>
						{t("welcome.titleLine1")}
						<br />
						<span className="tnd-welcome__accent">{t("welcome.titleLine2")}</span>
					</h1>
					<p className="tnd-welcome__lead">{t("welcome.lead")}</p>

					<div className="tnd-welcome__cta">
						<Link to="/dashboard" className="tnd-button tnd-button--accent tnd-button--lg">
							{t("welcome.openWorkspace")}
							<Icon name="arrowRight" size={18} aria-hidden />
						</Link>
						<Link to="/projects" className="tnd-button tnd-button--secondary tnd-button--lg">
							{t("welcome.createProject")}
						</Link>
						<Link to="/dashboard" className="tnd-button tnd-button--ghost tnd-button--lg">
							{t("welcome.exploreDemo")}
						</Link>
					</div>

					<div className="tnd-welcome__points">
						<Chip tone="brand">{t("welcome.pointUnified")}</Chip>
						<Chip tone="brand">{t("welcome.pointProjectNav")}</Chip>
						<Chip tone="ext">{t("welcome.pointExtension")}</Chip>
						<Chip tone="accent">{t("welcome.pointBrand")}</Chip>
					</div>
				</div>
			</main>
		</div>
	);
}
