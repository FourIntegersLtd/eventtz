"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoadingState } from "@/foundation/ui";
import { platformErrorDetail } from "@/foundation/platform-client";
import { fetchDisputes, type DisputePublic } from "@/domains/disputes/api";
import { DisputeStatusBadge } from "@/domains/disputes/DisputeStatusBadge";
import {
  DISPUTES_EMPTY_TITLE,
  DISPUTES_LIST_INTRO,
  DISPUTES_LOAD_ERROR,
  disputeBookingLabel,
  disputeListOpenedByLabel,
  disputesMostRecentlyOpened,
  disputeUpdatedLabel,
} from "@/domains/disputes/format";
import { disputeDetailHref, type DisputePortalRole } from "@/domains/disputes/role";

/**
 * `/client/disputes` and `/vendor/disputes` — every dispute the caller is
 * party to. The API (and `disputesMostRecentlyOpened`) order them most
 * recently opened first. Selecting a row opens that portal's detail page;
 * these pages do not file disputes or move money.
 */
export function DisputesListView({ role }: { role: DisputePortalRole }) {
  const [result, setResult] = useState<{ role: DisputePortalRole; disputes: DisputePublic[]; error: string | null } | null>(
    null,
  );
  // Loading follows whether the stored rows answer this role, so the effect
  // never calls setState itself — only the fetch's then/catch do.
  const loading = result === null || result.role !== role;
  const disputes = loading ? [] : result.disputes;
  const error = loading ? null : result.error;

  useEffect(() => {
    let cancelled = false;
    fetchDisputes(role)
      .then((rows) => {
        if (!cancelled) setResult({ role, disputes: disputesMostRecentlyOpened(rows), error: null });
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setResult({ role, disputes: [], error: platformErrorDetail(cause) ?? DISPUTES_LOAD_ERROR });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [role]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">{DISPUTES_LIST_INTRO}</p>

      {loading ? <LoadingState variant="inline" label="Loading disputes…" /> : null}

      {!loading && error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200/60">{error}</p>
      ) : null}

      {!loading ? (
        <div className="overflow-hidden rounded-2xl bg-white shadow-lg shadow-primary/5 ring-1 ring-primary-border">
          {disputes.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-neutral-600">{DISPUTES_EMPTY_TITLE}</p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {disputes.map((dispute) => (
                <li key={dispute.id}>
                  <Link
                    href={disputeDetailHref(role, dispute.id)}
                    className="block px-5 py-6 transition hover:bg-neutral-50/90 sm:px-6 sm:py-7"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="min-w-0 text-[15px] font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2">
                        {disputeBookingLabel(dispute)}
                      </p>
                      <DisputeStatusBadge status={dispute.status} />
                    </div>
                    <div className="mt-4 space-y-1.5">
                      <p className="line-clamp-2 text-sm text-neutral-600">{dispute.summary}</p>
                      <p className="text-sm text-neutral-500">Opened by {disputeListOpenedByLabel(dispute)}</p>
                      <p className="text-sm text-neutral-500">{disputeUpdatedLabel(dispute)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
