export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps {
	name: string;
	avatarUrl?: string;
	/** diameter preset; defaults to `md` */
	size?: AvatarSize;
}

function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "?";
	const first = parts[0]?.[0] ?? "";
	const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
	return (first + last).toUpperCase();
}

/**
 * Round identity badge. Falls back to deep-mint initials when no image is
 * provided. The accessible name is the person's name (image is decorative).
 */
export function Avatar({ name, avatarUrl, size = "md" }: AvatarProps) {
	const classes = ["tnd-avatar", size !== "md" ? `tnd-avatar--${size}` : ""]
		.filter(Boolean)
		.join(" ");
	return (
		<span className={classes} title={name}>
			{avatarUrl ? (
				<img src={avatarUrl} alt="" />
			) : (
				<span aria-hidden="true">{initials(name)}</span>
			)}
		</span>
	);
}
