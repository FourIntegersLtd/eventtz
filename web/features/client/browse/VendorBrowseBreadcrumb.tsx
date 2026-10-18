"use client";

import Link from "next/link";
import { SERVICE_OPTIONS } from "@/features/vendor/onboarding/constants";

type VendorBrowseBreadcrumbProps = {
  browseHref: string;
  categoryHref: string;
  categoryLabel: string;
  vendorName: string;
  className?: string;
};

export function vendorBrowseCategoryLabel(serviceValue: string | undefined): string {
  if (!serviceValue) return "Vendors";
  if (serviceValue === "photography") return "Photographers";
  if (serviceValue === "event_planning") return "Event planners";
  if (serviceValue === "dj") return "DJs & bands";
  if (serviceValue === "mc") return "MCs & alagas";
  if (serviceValue === "hair_styling") return "Hair stylists";
  return (
    SERVICE_OPTIONS.find((o) => o.value === serviceValue)?.label ?? "Vendors"
  );
}

/** Mobile-first trail: Home › category › vendor (ShadiSouk-style). */
export function VendorBrowseBreadcrumb({
  browseHref,
  categoryHref,
  categoryLabel,
  vendorName,
  className = "",
}: VendorBrowseBreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`text-sm text-ink-2 ${className}`.trim()}
    >
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <li>
          <Link href={browseHref} className="hover:text-ink">
            Home
          </Link>
        </li>
        <li aria-hidden className="text-ink-3">
          ›
        </li>
        <li>
          <Link href={categoryHref} className="hover:text-ink">
            {categoryLabel}
          </Link>
        </li>
        <li aria-hidden className="text-ink-3">
          ›
        </li>
        <li className="min-w-0 truncate font-medium text-ink">{vendorName}</li>
      </ol>
    </nav>
  );
}
