import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:opacity-80"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
        <div className="compliance-prose">{children}</div>
      </main>
      <LandingFooter sectionLinkPrefix="/" />
    </div>
  );
}
