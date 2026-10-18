"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Search, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { CLIENT_AUDIENCE_CTA, VENDOR_SECTION } from "@/features/landing/landingData";

type PathConfig = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
  Icon: LucideIcon;
};

const PATHS: PathConfig[] = [
  {
    eyebrow: "Clients",
    title: CLIENT_AUDIENCE_CTA.title,
    description: CLIENT_AUDIENCE_CTA.description,
    href: CLIENT_AUDIENCE_CTA.href,
    label: CLIENT_AUDIENCE_CTA.label,
    Icon: Search,
  },
  {
    eyebrow: "Vendors",
    title: "Show up where clients are searching",
    description: VENDOR_SECTION.title,
    href: VENDOR_SECTION.ctaHref,
    label: VENDOR_SECTION.ctaLabel,
    Icon: Store,
  },
];

function SectionEyebrow() {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-accent-gold">
      Get started
    </p>
  );
}

export function LandingPathsCta() {
  return (
    <>
      <div className="space-y-3 md:hidden">
        <SectionEyebrow />

        {PATHS.map((path) => {
          const isClient = path.eyebrow === "Clients";
          return (
            <Link
              key={path.eyebrow}
              href={path.href}
              className="block transition active:scale-[0.99]"
            >
              <Card
                variant={isClient ? "portal" : "callout"}
                className="flex items-start gap-3.5 p-4"
              >
                <PathIcon Icon={path.Icon} />
                <PathMobileCopy eyebrow={path.eyebrow} title={path.title} />
                <ChevronRight className="mt-3 h-5 w-5 shrink-0 self-start text-ink-3" aria-hidden />
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="hidden md:block">
        <SectionEyebrow />

        <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-stretch lg:gap-8">
          {PATHS.map((path) => (
            <PathDesktopCard key={path.eyebrow} path={path} />
          ))}
        </div>
      </div>
    </>
  );
}

function PathDesktopCard({ path }: { path: PathConfig }) {
  const { Icon, eyebrow, title, description, href, label } = path;
  const isClient = eyebrow === "Clients";

  return (
    <Card
      as="article"
      variant={isClient ? "portal" : "callout"}
      className="flex flex-col p-8 lg:p-10"
    >
      <div className="flex items-start gap-4">
        <PathIcon Icon={Icon} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-3">{eyebrow}</p>
          <h2 className="font-heading mt-2 text-2xl font-semibold leading-snug tracking-tight text-ink lg:text-[1.75rem]">
            {title}
          </h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-2 sm:text-base">{description}</p>

      <PathCta href={href} label={label} emphasis={isClient ? "primary" : "secondary"} />
    </Card>
  );
}

function PathCta({
  href,
  label,
  emphasis,
}: {
  href: string;
  label: string;
  emphasis: "primary" | "secondary";
}) {
  return (
    <div className="mt-8 flex justify-end pt-2">
      <ButtonLink
        href={href}
        variant={emphasis === "primary" ? "primary" : "secondary"}
        size="lg"
      >
        {label}
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
      </ButtonLink>
    </div>
  );
}

function PathIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-primary-soft text-primary ring-1 ring-primary-border">
      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
    </span>
  );
}

function PathMobileCopy({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">
        {eyebrow}
      </span>
      <span className="font-heading mt-0.5 block text-sm font-semibold leading-snug text-ink">
        {title}
      </span>
    </span>
  );
}
