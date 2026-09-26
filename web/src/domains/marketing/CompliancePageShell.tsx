import Link from "next/link";
import type { ReactNode } from "react";
import { MarketingShell } from "@/domains/marketing/MarketingShell";

/** The shared shell for the 5 `/compliances/*` legal pages: back link + the `.compliance-prose` reading styles. */
export function CompliancePageShell({ children }: { children: ReactNode }) {
  return (
    <MarketingShell>
      <div className="mx-auto w-full max-w-3xl px-4 pb-16 pt-10 sm:px-6 lg:px-8">
        <Link href="/" className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80">
          ← Back to home
        </Link>
        <div className="compliance-prose">{children}</div>
      </div>
    </MarketingShell>
  );
}
