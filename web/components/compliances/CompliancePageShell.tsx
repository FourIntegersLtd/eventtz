import type { ReactNode } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingNav } from "@/features/landing/LandingNav";

type CompliancePageShellProps = {
  children: ReactNode;
};

export function CompliancePageShell({ children }: CompliancePageShellProps) {
  return (
    <div className="min-h-dvh bg-page-bg text-neutral-900">
      <LandingNav variant="solid" sectionLinkPrefix="/" />
      <main className="mx-auto w-full max-w-4xl px-4 pb-10 pt-24 sm:px-6 sm:pb-14 sm:pt-28 lg:px-8">
        <BackLink href="/" label="Back to home" className="mb-8" />
        <div className="compliance-prose">{children}</div>
      </main>
      <LandingFooter sectionLinkPrefix="/" />
    </div>
  );
}
