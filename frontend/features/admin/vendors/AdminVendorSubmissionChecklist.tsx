"use client";

import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { VendorPanelCard, VendorPanelCardHeading, VendorPanelSectionHeader } from "./vendorDetailsPanel";
import type {
  AdminSubmissionChecklistGroup,
  AdminSubmissionChecklistItem,
} from "./adminVendorSubmissionReviewModel";

const GROUP_SECTION_IDS: Record<string, string> = {
  identity: "submission-identity",
  listing: "submission-listing",
  pricing: "submission-pricing",
  media: "submission-availability",
  legal: "submission-legal",
};

function scrollToSection(sectionId: string) {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function ChecklistRow({ item }: { item: AdminSubmissionChecklistItem }) {
  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div className="flex min-w-0 flex-1 items-start justify-between gap-4">
        <p className="shrink-0 text-sm font-medium leading-snug text-amber-900">{item.label}</p>
        <p className="min-w-0 text-right text-xs font-medium leading-snug text-amber-800/90">
          {item.detail}
        </p>
      </div>
    </li>
  );
}

function missingItems(groups: AdminSubmissionChecklistGroup[]): AdminSubmissionChecklistGroup[] {
  return (groups ?? [])
    .map((group) => ({
      ...group,
      items: (group.items ?? []).filter((item) => item.status === "warn"),
    }))
    .filter((group) => group.items.length > 0);
}

type Props = {
  groups: AdminSubmissionChecklistGroup[];
};

export function AdminVendorSubmissionChecklist({ groups }: Props) {
  const actionGroups = missingItems(groups);
  const missingCount = actionGroups.reduce((sum, group) => sum + group.items.length, 0);

  return (
    <section>
      <VendorPanelSectionHeader
        title="Pre-approval checklist"
        description={
          missingCount === 0
            ? "All required items are complete"
            : `${missingCount} item${missingCount === 1 ? "" : "s"} still needed before approval`
        }
        trailing={
          missingCount === 0 ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-200/60">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Ready to review
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200/60">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {missingCount} missing
            </span>
          )
        }
      />

      {missingCount === 0 ? (
        <VendorPanelCard>
          <p className="text-sm text-neutral-600">
            Nothing missing from the required checklist. Review the submission details below, then approve
            when ready.
          </p>
        </VendorPanelCard>
      ) : (
        <div className="space-y-5">
          {actionGroups.map((group) => {
            const sectionId = GROUP_SECTION_IDS[group.id];
            return (
              <VendorPanelCard key={group.id}>
                <VendorPanelCardHeading
                  title={group.title}
                  onClick={sectionId ? () => scrollToSection(sectionId) : undefined}
                />
                <ul className="divide-y divide-neutral-100">
                  {group.items.map((item) => (
                    <ChecklistRow key={item.id} item={item} />
                  ))}
                </ul>
              </VendorPanelCard>
            );
          })}
        </div>
      )}
    </section>
  );
}
