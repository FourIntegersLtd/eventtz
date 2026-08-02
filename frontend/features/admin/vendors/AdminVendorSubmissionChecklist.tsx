"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { VendorPanelCard, VendorPanelCardHeading, VendorPanelSectionHeader } from "./vendorDetailsPanel";
import type {
  AdminSubmissionChecklistGroup,
  AdminSubmissionChecklistItem,
  AdminSubmissionChecklistStatus,
} from "./adminVendorSubmissionReviewModel";

const GROUP_SECTION_IDS: Record<string, string> = {
  identity: "submission-identity",
  listing: "submission-listing",
  pricing: "submission-pricing",
  media: "submission-availability",
  legal: "submission-legal",
};

function ChecklistStatusIcon({ status }: { status: AdminSubmissionChecklistStatus }) {
  if (status === "pass") {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
  }
  if (status === "warn") {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />;
}

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ChecklistRow({ item }: { item: AdminSubmissionChecklistItem }) {
  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <ChecklistStatusIcon status={item.status} />
      <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
        <p
          className={`shrink-0 text-sm font-medium leading-snug ${
            item.status === "warn"
              ? "text-amber-900"
              : item.status === "pass"
                ? "text-neutral-900"
                : "text-neutral-800"
          }`}
        >
          {item.label}
        </p>
        <p
          className={`min-w-0 text-right text-xs leading-snug ${
            item.status === "warn"
              ? "font-medium text-amber-800/90"
              : item.status === "pass"
                ? "text-neutral-500"
                : "text-neutral-400"
          }`}
        >
          {item.detail}
        </p>
      </div>
    </li>
  );
}

type Props = {
  groups: AdminSubmissionChecklistGroup[];
};

export function AdminVendorSubmissionChecklist({ groups }: Props) {
  const safeGroups = groups ?? [];
  const allItems = safeGroups.flatMap((g) => g.items ?? []);
  const passCount = allItems.filter((i) => i.status === "pass").length;
  const warnCount = allItems.filter((i) => i.status === "warn").length;
  const infoCount = allItems.filter((i) => i.status === "info").length;
  const total = allItems.length;

  return (
    <section>
      <VendorPanelSectionHeader
        title="Pre-approval checklist"
        description={
          <>
            {passCount} passed
            {warnCount > 0 ? ` · ${warnCount} need attention` : ""}
            {infoCount > 0 ? ` · ${infoCount} optional` : ""}
            {total > 0 ? ` · ${total} total` : ""}
          </>
        }
        trailing={
          warnCount === 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/60">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Ready to review
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/60">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {warnCount} to fix
            </span>
          )
        }
      />

      <div className="space-y-5">
        {safeGroups.map((group) => {
          const sectionId = GROUP_SECTION_IDS[group.id];
          return (
            <VendorPanelCard key={group.id}>
              <VendorPanelCardHeading
                title={group.title}
                onClick={sectionId ? () => scrollToSection(sectionId) : undefined}
              />
              <ul className="divide-y divide-neutral-100">
                {(group.items ?? []).map((item) => (
                  <ChecklistRow key={item.id} item={item} />
                ))}
              </ul>
            </VendorPanelCard>
          );
        })}
      </div>
    </section>
  );
}
