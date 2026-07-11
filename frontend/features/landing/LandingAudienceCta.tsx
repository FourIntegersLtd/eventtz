"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LandingSection } from "@/features/landing/LandingSection";

export function LandingAudienceCta() {
  return (
    <LandingSection className="py-16 sm:py-20 md:py-24" width="6xl">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <div className="flex flex-col justify-between rounded-3xl bg-gradient-to-br from-primary to-violet-900 p-8 text-white sm:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/90">Clients</p>
            <h2 className="font-heading mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Stop starting in the group chat.
            </h2>
            <p className="mt-2 text-sm text-violet-100/90">
              Find vetted vendors. Book with a paper trail.
            </p>
          </div>
          <Link
            href="/client/browse"
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary transition hover:opacity-90"
          >
            Browse vendors
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border border-primary-border bg-primary-soft/40 p-8 shadow-sm sm:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Vendors</p>
            <h2 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Stop waiting for the referral.
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Get found by clients who are ready to book.
            </p>
          </div>
          <Link
            href="/register?type=vendor"
            className="mt-8 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Join as a vendor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </div>
    </LandingSection>
  );
}
