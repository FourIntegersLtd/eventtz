"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewBodyText } from "./ReviewBodyText";
import { formatReviewWhen } from "./reviewFormatters";

export type ReviewCardProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  rating: number;
  body: string;
  createdAt?: string | null;
  bookingHref?: string | null;
  bookingLinkLabel?: string;
  titleHref?: string | null;
  previewLen?: number;
  compact?: boolean;
};

export function ReviewCard({
  title,
  subtitle,
  rating,
  body,
  createdAt,
  bookingHref,
  bookingLinkLabel = "View booking",
  titleHref,
  previewLen,
  compact = false,
}: ReviewCardProps) {
  const titleNode =
    titleHref && typeof title === "string" ? (
      <Link href={titleHref} className="font-medium text-primary hover:underline">
        {title}
      </Link>
    ) : (
      <p className="font-medium text-neutral-900">{title}</p>
    );

  return (
    <article
      className={`rounded-xl border border-neutral-200/80 bg-neutral-50/40 ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {titleNode}
          {subtitle ? <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p> : null}
        </div>
        <StarRating rating={rating} size="sm" />
      </div>

      <div className="mt-3">
        <ReviewBodyText body={body} previewLen={previewLen} />
      </div>

      {createdAt || bookingHref ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
          {createdAt ? <span>{formatReviewWhen(createdAt)}</span> : null}
          {bookingHref ? (
            <Link href={bookingHref} className="font-medium text-primary hover:underline">
              {bookingLinkLabel}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
