import type { Metadata } from "next";
import { CompliancePageShell } from "@/components/compliances/CompliancePageShell";
import { TermsOfServiceContent } from "@/components/compliances/content/TermsOfServiceContent";

export const metadata: Metadata = {
  title: "Terms of Service | Eventtz",
  description:
    "Terms governing your use of Eventtz, bookings, payments, and vendor services.",
};

export default function TermsOfServicePage() {
  return (
    <CompliancePageShell>
      <TermsOfServiceContent />
    </CompliancePageShell>
  );
}
