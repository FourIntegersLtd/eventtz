import type { Metadata } from "next";
import { CompliancePageShell } from "@/domains/marketing/CompliancePageShell";
import { ReferralsPolicyContent } from "@/domains/marketing/ReferralsPolicyContent";

export const metadata: Metadata = {
  title: "Referral Policy | Eventtz",
  description: "How Eventtz's referral programmes work.",
};

/** `/compliances/referrals`. */
export default function ReferralsPolicyPage() {
  return (
    <CompliancePageShell>
      <ReferralsPolicyContent />
    </CompliancePageShell>
  );
}
