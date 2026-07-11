import type { Metadata } from "next";
import { CompliancePageShell } from "@/components/compliances/CompliancePageShell";
import { CookiesPolicyContent } from "@/components/compliances/content/CookiesPolicyContent";

export const metadata: Metadata = {
  title: "Cookie Policy | Eventtz",
  description: "How Eventtz uses cookies and similar technologies.",
};

export default function CookiesPolicyPage() {
  return (
    <CompliancePageShell>
      <CookiesPolicyContent />
    </CompliancePageShell>
  );
}
