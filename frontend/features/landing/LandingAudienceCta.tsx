"use client";

import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LandingSection } from "@/features/landing/LandingSection";
import { landingSectionClass } from "@/features/landing/landingSectionStyles";

export function LandingAudienceCta() {
  return (
    <LandingSection className={landingSectionClass("muted")} width="6xl">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <div className="flex flex-col justify-between rounded-3xl bg-gradient-to-br from-primary to-violet-900 p-8 text-white sm:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-200/90">Clients</p>
            <h2 className="font-heading mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Stop starting in the group chat.
            </h2>
            <p className="mt-2 text-sm text-violet-100/90">
              Find vetted vendors and book with confidence.
            </p>
          </div>
          <ButtonLink
            href="/client/browse"
            variant="inverted"
            shape="pill"
            className="mt-8 w-fit px-6 py-3"
          >
            Browse vendors
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
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
          <ButtonLink
            href="/register?type=vendor"
            shape="pill"
            className="mt-8 w-fit px-6 py-3"
          >
            Join as a vendor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
      </div>
    </LandingSection>
  );
}
