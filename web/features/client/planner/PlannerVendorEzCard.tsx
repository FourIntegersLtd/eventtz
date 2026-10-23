"use client";

import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { PlannerVendorCard } from "@/lib/clientPlannerApi";
import { SERVICE_OPTIONS } from "@/lib/vendorOnboarding/constants";
import { PLANNER_COPY } from "./plannerCopy";
import { formatVendorPrice } from "./plannerModel";

type PlannerVendorEzCardProps = {
  vendor: PlannerVendorCard;
  serviceKey: string;
  profileHref: string;
  selected: boolean;
  onToggleSelected: () => void;
  disabled?: boolean;
};

function serviceLabel(serviceKey: string, services: string[]): string {
  const fromKey = SERVICE_OPTIONS.find((option) => option.value === serviceKey)?.label;
  if (fromKey) return fromKey;
  const first = services[0];
  if (!first) return "Vendor";
  return SERVICE_OPTIONS.find((option) => option.value === first)?.label ?? first;
}

/** C07 vendor tile (`ez-vcard`) for planner recommendations. */
export function PlannerVendorEzCard({
  vendor,
  serviceKey,
  profileHref,
  selected,
  onToggleSelected,
  disabled = false,
}: PlannerVendorEzCardProps) {
  const unavailable = vendor.unavailable;
  const rating =
    vendor.review_average != null && vendor.review_count > 0
      ? vendor.review_average.toFixed(1)
      : null;

  return (
    <article className="ez-vcard">
      <div className="ez-vcard__media">
        {vendor.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- vendor S3 URL from API
          <img src={vendor.cover_image_url} alt="" />
        ) : (
          <span className="ez-ph" aria-hidden />
        )}
      </div>
      <div className="ez-vcard__body">
        <h3 className="ez-vcard__name">{vendor.business_name || "Vendor"}</h3>
        <div className="ez-vcard__meta">
          <span>{serviceLabel(serviceKey, vendor.services)}</span>
          {vendor.base_city ? (
            <span>
              <MapPin width={13} height={13} strokeWidth={1.75} aria-hidden />
              {vendor.base_city}
            </span>
          ) : null}
        </div>
        {rating ? (
          <div className="ez-hrow" style={{ gap: 6 }}>
            <span className="ez-rating">
              <Star width={15} height={15} strokeWidth={1.75} aria-hidden />
              {rating}
            </span>
            <span className="ez-caption">({vendor.review_count} reviews)</span>
          </div>
        ) : null}
        {unavailable ? (
          <p className="ez-caption" style={{ color: "var(--ez-warning-ink)" }}>{PLANNER_COPY.unavailable}</p>
        ) : (
          <label className="ez-check" style={{ paddingTop: 0, minHeight: 0 }}>
            <input
              type="checkbox"
              checked={selected}
              disabled={disabled || unavailable}
              onChange={onToggleSelected}
              aria-label={`Include ${vendor.business_name} in enquiry`}
            />
            <span>Include in enquiry</span>
          </label>
        )}
      </div>
      <div className="ez-vcard__foot">
        <span className="ez-small">
          {vendor.price_on_request ? (
            PLANNER_COPY.priceOnRequest
          ) : (
            <>
              From <span className="ez-strong ez-num">{formatVendorPrice(vendor).replace(/^from /i, "")}</span>
            </>
          )}
        </span>
        <Link className="ez-link" href={profileHref}>View</Link>
      </div>
    </article>
  );
}
