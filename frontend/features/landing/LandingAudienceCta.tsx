"use client";

import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { LandingSection } from "@/features/landing/LandingSection";
import { landingSectionClass } from "@/features/landing/landingSectionStyles";

const audienceCardBase =
  "flex flex-col justify-between rounded-3xl border border-primary-border/60 p-8 shadow-sm sm:p-10";

export function LandingAudienceCta() {
  return (
    <LandingSection className={landingSectionClass("muted")} width="6xl">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
        <div className={`${audienceCardBase} bg-primary-soft/25`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Clients</p>
            <h2 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Stop searching in the group chat.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Find vetted vendors, agree the details in one place, and book without another group chat.
            </p>
          </div>
          <ButtonLink href="/client/browse" shape="pill" className="mt-8 w-fit px-6 py-3">
            Browse vendors
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>

        <div className={`${audienceCardBase} bg-white`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Vendors</p>
            <h2 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">
              Show up where clients are searching.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              Take bookings from one profile and get paid seamlessly.
            </p>
          </div>
          <ButtonLink href="/register?type=vendor" shape="pill" className="mt-8 w-fit px-6 py-3">
            Join as a vendor
            <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>
      </div>
    </LandingSection>
  );
}
