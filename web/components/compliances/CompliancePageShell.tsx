import type { ReactNode } from "react";
import { BackLink } from "@/components/ui/BackLink";
import { ComplianceReader } from "@/components/compliances/ComplianceReader";
import { LandingFooter } from "@/features/landing/LandingFooter";
import { LandingNav } from "@/features/landing/LandingNav";
import { LandingSection } from "@/features/landing/LandingSection";
import { LANDING_NAV_OFFSET_CLASS } from "@/features/landing/landingSectionStyles";

type CompliancePageShellProps = {
  children: ReactNode;
};

/** Frame for the legal pages: landing nav and footer around a contents list and the policy text. */
export function CompliancePageShell({ children }: CompliancePageShellProps) {
  return (
    <div className="min-h-dvh bg-page-bg text-ink">
      <LandingNav variant="solid" sectionLinkPrefix="/" />
      <div className={LANDING_NAV_OFFSET_CLASS}>
        <div className="bg-page-bg py-10 sm:py-12">
          <LandingSection>
            <BackLink href="/" label="Back to home" className="mb-8" />
            <ComplianceReader>{children}</ComplianceReader>
          </LandingSection>
        </div>
      </div>
      <LandingFooter sectionLinkPrefix="/" />
    </div>
  );
}
