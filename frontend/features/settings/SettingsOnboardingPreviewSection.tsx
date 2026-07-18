"use client";

import Link from "next/link";
import { Route } from "lucide-react";

export function SettingsOnboardingPreviewSection() {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Setup tour</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            Run through vendor setup from the start.
          </p>
        </div>
        <Link
          href="/vendor/profile?walkthrough=1"
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50"
        >
          <Route className="h-4 w-4" aria-hidden />
          Start walkthrough
        </Link>
      </div>
    </section>
  );
}
