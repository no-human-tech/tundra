export interface SkipLinkProps {
	/** id of the main landmark to jump to (without the leading #) */
	targetId: string;
	/**
	 * Overridable link text (e.g. translated). Defaults to "Skip to content".
	 * `children`, when provided, takes precedence over `label` for back-compat.
	 */
	label?: string;
	children?: React.ReactNode;
}

/**
 * Skip-to-content link. Must be the first focusable element on the page. It is
 * visually hidden until focused (see global.css `.tnd-skip-link`).
 *
 * The link text is overridable for i18n via `children` (preferred for rich
 * content) or the `label` prop; both default to the English "Skip to content".
 */
export function SkipLink({ targetId, label = "Skip to content", children }: SkipLinkProps) {
	return (
		<a className="tnd-skip-link" href={`#${targetId}`}>
			{children ?? label}
		</a>
	);
}
