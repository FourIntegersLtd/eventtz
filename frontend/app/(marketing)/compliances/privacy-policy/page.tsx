import type { Metadata } from "next";
import { CompliancePageShell } from "@/components/compliances/CompliancePageShell";
import { PrivacyPolicyContent } from "@/components/compliances/content/PrivacyPolicyContent";

export const metadata: Metadata = {
  title: "Privacy Policy | Eventtz",
  description:
    "How Eventtz collects, uses, and protects your personal data on our UK marketplace for African event vendors.",
};

export default function PrivacyPolicyPage() {
  return (
    <CompliancePageShell>
      <PrivacyPolicyContent />
    </CompliancePageShell>
  );
}
