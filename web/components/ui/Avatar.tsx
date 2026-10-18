export type AvatarSize = "sm" | "md" | "lg";

export type AvatarProps = {
  /** Full name; the initials fall back from this when there is no image. */
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
};

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

/** Up to two uppercase initials from a name ("Amaka Obi" gives "AO"). */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

/** Round avatar: the image when given, otherwise brand-tinted initials. */
export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
  const sizeClasses = SIZE_CLASSES[size];
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`shrink-0 rounded-full object-cover ${sizeClasses} ${className}`.trim()}
      />
    );
  }
  return (
    <span
      role="img"
      aria-label={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary-soft font-medium text-primary ${sizeClasses} ${className}`.trim()}
    >
      {getInitials(name)}
    </span>
  );
}
