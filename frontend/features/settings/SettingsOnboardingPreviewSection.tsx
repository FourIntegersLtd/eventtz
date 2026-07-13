"use client";

import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import Link from "next/link";
import { Route } from "lucide-react";

export function SettingsOnboardingPreviewSection() {
  return (
    <section className={`${portalCard} ${portalCardPadding}`}>
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Setup tour</h2>
      <p className="mt-1 text-sm text-neutral-500">Run through vendor setup from the start.</p>
      <Link
        href="/vendor/profile?walkthrough=1"
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 py-3 text-sm font-semibold text-primary ring-1 ring-primary/20 transition hover:bg-primary/15 sm:w-auto"
      >
        <Route className="h-4 w-4" aria-hidden />
        Start walkthrough
      </Link>
    </section>
  );
}
