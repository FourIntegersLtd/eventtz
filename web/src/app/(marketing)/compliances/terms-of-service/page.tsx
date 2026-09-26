import type { Metadata } from "next";
import { CompliancePageShell } from "@/domains/marketing/CompliancePageShell";
import { TermsOfServiceContent } from "@/domains/marketing/TermsOfServiceContent";

export const metadata: Metadata = {
  title: "Terms of Service | Eventtz",
  description: "The terms governing use of Eventtz.",
};

/** `/compliances/terms-of-service`. */
export default function TermsOfServicePage() {
  return (
    <CompliancePageShell>
      <TermsOfServiceContent />
    </CompliancePageShell>
  );
}
