import type { Metadata } from "next";
import { CompliancePageShell } from "@/components/compliances/CompliancePageShell";
import { LegalDisclaimerContent } from "@/components/compliances/content/LegalDisclaimerContent";

export const metadata: Metadata = {
  title: "Legal Disclaimer | Eventtz",
  description:
    "Important legal information about Eventtz as a marketplace platform.",
};

export default function LegalDisclaimerPage() {
  return (
    <CompliancePageShell>
      <LegalDisclaimerContent />
    </CompliancePageShell>
  );
}
