import Image from "next/image";
import Link from "next/link";

type EventtzLogoProps = {
  /** Where the logo links (default: home / marketing). */
  href?: string;
  /** Wrapper class (default aligns logo like a nav brand). */
  className?: string;
  /** Preset sizing: `header` (auth/marketing, larger) or `sidebar` (app shell). */
  variant?: "header" | "sidebar";
  /** `light` is purple on a light background; `dark` is white on purple. */
  tone?: "light" | "dark";
  /** Overrides preset `imageClassName` when set. */
  imageClassName?: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

const VARIANTS = {
  header: {
    width: 70,
    height: 17,
    imageClassName: "h-3.5 w-auto sm:h-[15px] md:h-[17px]",
  },
  sidebar: {
    width: 70,
    height: 17,
    imageClassName: "h-[15px] w-auto md:h-[17px]",
  },
} as const;

/**
 * Central Eventtz wordmark, an SVG in `public/images/` (light and dark colourways).
 * `variant` is the size preset; `tone` picks the colourway for the background it sits on.
 * Presets match the vector logo's 1052:256 shape, sized to the wordmark the old padded PNG showed.
 */
export function EventtzLogo({
  href = "/",
  className = "inline-flex shrink-0 items-center",
  variant = "header",
  tone = "light",
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
        src={`/images/eventtz-logo-${tone}.svg`}
        unoptimized
        alt="Eventtz"
        width={width}
        height={height}
        className={imageClassName}
        priority={priority}
      />
    </Link>
  );
}
