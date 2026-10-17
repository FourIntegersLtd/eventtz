import type { Metadata } from "next";
import { CompliancePageShell } from "@/components/compliances/CompliancePageShell";
import { TermsOfServiceContent20260701 } from "@/components/compliances/content/TermsOfServiceContent20260701";

export const metadata: Metadata = {
  title: "Terms of Service (1 July 2026) | Eventtz",
  description: "The previous version of the Eventtz Terms of Service, effective 1 July 2026.",
};

export default function PreviousTermsOfServicePage() {
  return (
    <CompliancePageShell>
      <TermsOfServiceContent20260701 />
    </CompliancePageShell>
  );
}
