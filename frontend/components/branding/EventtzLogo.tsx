import Image from "next/image";
import Link from "next/link";

type EventtzLogoProps = {
  /** Where the logo links (default: home / marketing). */
  href?: string;
  /** Wrapper class (default aligns logo like a nav brand). */
  className?: string;
  /** Preset sizing: `header` (auth/marketing, larger) or `sidebar` (app shell). */
  variant?: "header" | "sidebar";
  /** Overrides preset `imageClassName` when set. */
  imageClassName?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

const VARIANTS = {
  header: {
    width: 220,
    height: 80,
    imageClassName: "h-12 w-auto sm:h-14 md:h-16",
  },
  sidebar: {
    width: 180,
    height: 64,
    imageClassName: "h-10 w-auto md:h-11",
  },
} as const;

/**
 * Central Eventtz wordmark from `public/images/eventtz-logo.png`.
 * Default `header` variant is larger than the previous inline copies for clearer branding.
 */
export function EventtzLogo({
  href = "/",
  className = "inline-flex shrink-0 items-center",
  variant = "header",
  imageClassName: imageClassNameProp,
  width: widthProp,
  height: heightProp,
  priority = false,
}: EventtzLogoProps) {
  const preset = VARIANTS[variant];
  const width = widthProp ?? preset.width;
  const height = heightProp ?? preset.height;
  const imageClassName = imageClassNameProp ?? preset.imageClassName;
  return (
    <Link href={href} className={className}>
      <Image
        src="/images/eventtz-logo.png"
        alt="Eventtz"
        width={width}
        height={height}
        className={imageClassName}
        priority={priority}
      />
    </Link>
  );
}
