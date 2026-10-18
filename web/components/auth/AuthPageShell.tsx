import type { ReactNode } from "react";
import { AuthPanelArt } from "@/components/auth/AuthPanelArt";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { BackLink } from "@/components/ui/BackLink";

type AuthPageShellProps = {
  children: ReactNode;
  logoHref: string;
  /** Override the form side background (e.g. admin theme). */
  className?: string;
  /** Extra classes on the form column. */
  contentClassName?: string;
  /** Shown above the form when the user may want to leave auth without signing in. */
  backHref?: string;
  backLabel?: string;
  /** Serif headline on the brand panel. */
  headline?: string;
  /** Optional supporting line under the headline. */
  supportingLine?: string;
  /** Replaces the decorative art in the panel (register shows its route steps). */
  panelContent?: ReactNode;
};

/**
 * Split-screen auth layout: a purple brand panel (logo tile, headline, art,
 * caption) beside a centred form column. Below `lg` the panel collapses to a
 * compact strip with the logo and headline, and the art is hidden.
 */
export function AuthPageShell({
  children,
  logoHref,
  className = "bg-[var(--page-bg)]",
  contentClassName = "",
  backHref = "/",
  backLabel = "Back to home",
  headline = "Every vendor for your day, in one place.",
  supportingLine,
  panelContent,
}: AuthPageShellProps) {
  // Custom panel content carries its own copy, so the headline stays in the mobile strip only.
  const mobileHeadlineOnly = panelContent !== undefined;
  return (
    <main className="flex min-h-dvh flex-col overflow-x-hidden lg:flex-row">
      <aside className="relative flex flex-col gap-6 overflow-hidden bg-primary px-6 py-6 text-white lg:w-1/2 lg:justify-between lg:gap-8 lg:p-12">
        <span
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/[0.14]"
          aria-hidden
        />
        <span
          className="pointer-events-none absolute -right-8 -top-8 h-44 w-44 rounded-full border border-white/[0.14]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6">
          {/* The only place the auth logo is placed. */}
          <EventtzLogo priority tone="dark" href={logoHref} imageClassName="h-7 w-auto lg:h-8" />
          <div className="max-w-md space-y-2">
            <p
              className={`font-heading text-2xl font-semibold leading-tight text-white lg:text-4xl ${mobileHeadlineOnly ? "lg:hidden" : ""}`.trim()}
            >
              {headline}
            </p>
            {mobileHeadlineOnly || !supportingLine ? null : (
              <p className="hidden text-base text-white/80 lg:block">{supportingLine}</p>
            )}
          </div>
        </div>
        <div className="relative hidden flex-1 items-center justify-center lg:flex">
          {panelContent ?? <AuthPanelArt />}
        </div>
        <p className="relative hidden text-center text-sm text-white/70 lg:block">
          Trusted by clients and vendors across the UK
        </p>
      </aside>
      <div
        className={`flex flex-1 items-start justify-center px-6 py-8 lg:items-center lg:w-1/2 lg:py-12 ${className}`.trim()}
      >
        <div className={`flex w-full max-w-[420px] flex-col gap-5 ${contentClassName}`.trim()}>
          <BackLink href={backHref} label={backLabel} tone="muted" />
          {children}
        </div>
      </div>
    </main>
  );
}
