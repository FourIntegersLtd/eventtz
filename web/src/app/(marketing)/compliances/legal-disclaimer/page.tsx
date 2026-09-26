import type { Metadata } from "next";
import { CompliancePageShell } from "@/domains/marketing/CompliancePageShell";
import { LegalDisclaimerContent } from "@/domains/marketing/LegalDisclaimerContent";

export const metadata: Metadata = {
  title: "Legal Disclaimer | Eventtz",
  description: "Eventtz's legal disclaimer for clients and vendors.",
};

/** `/compliances/legal-disclaimer`. */
export default function LegalDisclaimerPage() {
  return (
    <CompliancePageShell>
      <LegalDisclaimerContent />
    </CompliancePageShell>
  );
}
