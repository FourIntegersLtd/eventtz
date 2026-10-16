import type { Metadata } from "next";
import { CompliancePageShell } from "@/components/compliances/CompliancePageShell";
import { ReferralsPolicyContent } from "@/components/compliances/content/ReferralsPolicyContent";

export const metadata: Metadata = {
  title: "Referral Policy | Eventtz",
  description: "How referral and invite programmes work on Eventtz when offered.",
};

export default function ReferralsPolicyPage() {
  return (
    <CompliancePageShell>
      <ReferralsPolicyContent />
    </CompliancePageShell>
  );
}
