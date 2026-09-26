import type { Metadata } from "next";
import { CompliancePageShell } from "@/domains/marketing/CompliancePageShell";
import { CookiesPolicyContent } from "@/domains/marketing/CookiesPolicyContent";

export const metadata: Metadata = {
  title: "Cookie Policy | Eventtz",
  description: "How Eventtz uses cookies and similar technologies.",
};

/** `/compliances/cookies-policy`. */
export default function CookiesPolicyPage() {
  return (
    <CompliancePageShell>
      <CookiesPolicyContent />
    </CompliancePageShell>
  );
}
