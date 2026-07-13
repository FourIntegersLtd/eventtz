"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Search, Store } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { ButtonLink } from "@/components/ui/ButtonLink";
import { CLIENT_AUDIENCE_CTA, VENDOR_SECTION } from "@/features/landing/landingData";

type PathConfig = {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  label: string;
  Icon: LucideIcon;
};

const PATH_CTA_CLASS = "px-6 py-3 leading-none";
const PATH_CARD_BASE_CLASS =
  "flex flex-col rounded-3xl border border-primary-border/60 p-8 shadow-sm lg:p-10";
const PATH_CARD_CLIENT_CLASS = `${PATH_CARD_BASE_CLASS} bg-white`;
const PATH_CARD_VENDOR_CLASS = `${PATH_CARD_BASE_CLASS} bg-primary-soft/30`;

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
    title: "Show up where clients are searching.",
    description: VENDOR_SECTION.title,
    href: VENDOR_SECTION.ctaHref,
    label: VENDOR_SECTION.ctaLabel,
    Icon: Store,
  },
];

function SectionEyebrow() {
  return (
    <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-primary">
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
              className={`flex items-center gap-3.5 rounded-2xl border border-primary-border/60 p-4 shadow-sm transition active:scale-[0.99] ${
                isClient ? "bg-white" : "bg-primary-soft/30"
              }`}
            >
              <PathIcon Icon={path.Icon} />
              <PathMobileCopy eyebrow={path.eyebrow} title={path.title} />
              <ChevronRight className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
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
    <article className={isClient ? PATH_CARD_CLIENT_CLASS : PATH_CARD_VENDOR_CLASS}>
      <div className="flex items-start gap-4">
        <PathIcon Icon={Icon} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
          <h2 className="font-heading mt-2 text-2xl font-semibold leading-snug tracking-tight text-primary lg:text-[1.75rem]">
            {title}
          </h2>
        </div>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-neutral-600 sm:text-base">{description}</p>

      <PathCta href={href} label={label} emphasis={isClient ? "primary" : "secondary"} />
    </article>
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
  const secondaryClass =
    "!bg-white !text-primary border border-primary-border shadow-sm hover:!bg-primary-soft/35 hover:!opacity-100";

  return (
    <div className="mt-8 flex justify-end pt-2">
      <ButtonLink
        href={href}
        variant="primary"
        shape="pill"
        className={`${PATH_CTA_CLASS} ${emphasis === "secondary" ? secondaryClass : ""}`}
      >
        {label}
        <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
      </ButtonLink>
    </div>
  );
}

function PathIcon({ Icon }: { Icon: LucideIcon }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft/40 text-primary ring-1 ring-primary-border/60">
      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden />
    </span>
  );
}

function PathMobileCopy({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/80">
        {eyebrow}
      </span>
      <span className="font-heading mt-0.5 block text-[15px] font-semibold leading-snug text-primary">
        {title}
      </span>
    </span>
  );
}
