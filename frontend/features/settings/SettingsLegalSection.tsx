"use client";

import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

const LEGAL_LINKS = [
  { href: "/compliances/privacy-policy", label: "Privacy policy" },
  { href: "/compliances/terms-of-service", label: "Terms of service" },
  { href: "/compliances/cookies-policy", label: "Cookies policy" },
] as const;

export function SettingsLegalSection() {
  return (
    <section className={`${portalCard} ${portalCardPadding}`}>
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Legal</h2>
      <ul className="mt-4 divide-y divide-neutral-100">
        {LEGAL_LINKS.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center gap-3 py-3 transition hover:bg-neutral-50/80 -mx-2 px-2 rounded-xl"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                <FileText className="h-4 w-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">{item.label}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
