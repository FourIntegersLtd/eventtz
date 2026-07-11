"use client";

import type { ReactNode } from "react";
import { firstPortfolioImageUrlFromPayload } from "@/lib/vendorPortfolioImages";

type VendorPortfolioCoverProps = {
  payload: Record<string, unknown>;
  businessName?: string;
  className?: string;
  overlay?: ReactNode;
  /** Shorter cover area — full image visible, no crop. */
  heightClass?: string;
};

export function VendorPortfolioCover({
  payload,
  businessName = "Vendor",
  className = "rounded-xl",
  overlay,
  heightClass = "h-24",
}: VendorPortfolioCoverProps) {
  const coverUrl = firstPortfolioImageUrlFromPayload(payload);

  return (
    <div
      className={`relative overflow-hidden bg-neutral-100 ${heightClass} ${className}`}
    >
      {coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-center"
            decoding="async"
          />
          {overlay ? (
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent"
              aria-hidden
            />
          ) : null}
        </>
      ) : (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#f4f0fa] via-white to-[#e9def9]">
          <span className="font-heading text-2xl font-semibold text-neutral-300/90">
            {businessName.slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
      {overlay ? <div className="relative z-10 p-2.5">{overlay}</div> : null}
    </div>
  );
}
