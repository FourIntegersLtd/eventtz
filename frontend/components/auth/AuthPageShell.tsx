import type { ReactNode } from "react";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { authPageBg, authPageGradient } from "@/components/portal-shell/portalTheme";
import { BackLink } from "@/components/ui/BackLink";

type AuthPageShellProps = {
  children: ReactNode;
  logoHref: string;
  /** Shown in the header when the user may want to leave auth without signing in. */
  backHref?: string;
  backLabel?: string;
};

export function AuthPageShell({
  children,
  logoHref,
  backHref = "/",
  backLabel = "Back to home",
}: AuthPageShellProps) {
  return (
    <main className={`relative min-h-dvh overflow-x-hidden ${authPageBg}`}>
      {/* Soft branded gradient + blurred blobs so the auth pages don't read as a bare form on a flat tint. */}
      <div
        className={`pointer-events-none absolute inset-0 ${authPageGradient}`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-1/3 h-96 w-96 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 border-b border-neutral-200/60 bg-white/40 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-12">
        <div className="flex items-center justify-between gap-4">
          <EventtzLogo priority href={logoHref} />
          <BackLink href={backHref} label={backLabel} tone="muted" />
        </div>
      </header>
      <div className="relative z-10 flex items-center justify-center px-4 py-10 sm:py-14">
        {children}
      </div>
    </main>
  );
}
