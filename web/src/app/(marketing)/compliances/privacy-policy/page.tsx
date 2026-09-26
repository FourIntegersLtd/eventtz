import type { Metadata } from "next";
import { CompliancePageShell } from "@/domains/marketing/CompliancePageShell";
import { PrivacyPolicyContent } from "@/domains/marketing/PrivacyPolicyContent";

export const metadata: Metadata = {
  title: "Privacy Policy | Eventtz",
  description: "How Eventtz collects, uses, and protects personal data.",
};

/** `/compliances/privacy-policy`. */
export default function PrivacyPolicyPage() {
  return (
    <CompliancePageShell>
      <PrivacyPolicyContent />
    </CompliancePageShell>
  );
}
