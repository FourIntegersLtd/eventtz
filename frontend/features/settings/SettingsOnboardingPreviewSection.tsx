"use client";

import Link from "next/link";
import { Route } from "lucide-react";
import { SettingsSection } from "./SettingsSection";

export function SettingsOnboardingPreviewSection() {
  return (
    <SettingsSection
      title="Setup tour"
      description="Run through vendor setup from the start."
      trailing={
        <Link
          href="/vendor/profile?walkthrough=1"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
        >
          <Route className="h-4 w-4" aria-hidden />
          Start walkthrough
        </Link>
      }
    />
  );
}
