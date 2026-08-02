"use client";

import type { ReactNode } from "react";
import { VendorPanelCard, VendorPanelSection } from "./vendorDetailsPanel";
import type { AdminSubmissionField } from "./adminVendorSubmissionReviewModel";

export const DetailSection = VendorPanelSection;
export const SubmissionCard = VendorPanelCard;

export function SubmissionField({
  label,
  value,
  missing,
}: {
  label: string;
  value: ReactNode;
  missing?: boolean;
}) {
  return (
    <div className="py-1">
      <dt className="text-[13px] text-neutral-500">{label}</dt>
      <dd
        className={`mt-1.5 text-sm leading-relaxed ${
          missing ? "font-medium text-amber-800" : "text-neutral-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function SubmissionFieldGrid({ fields }: { fields: AdminSubmissionField[] }) {
  const safeFields = fields ?? [];
  if (safeFields.length === 0) {
    return (
      <SubmissionCard>
        <p className="text-sm text-neutral-500">Nothing submitted.</p>
      </SubmissionCard>
    );
  }

  const midpoint = Math.ceil(safeFields.length / 2);
  const left = safeFields.slice(0, midpoint);
  const right = safeFields.slice(midpoint);

  return (
    <SubmissionCard>
      <dl>
        <div className="grid gap-0 sm:grid-cols-2">
          <div className="space-y-5 sm:border-r sm:border-neutral-100 sm:pr-6">
            {left.map((f) => (
              <SubmissionField
                key={f.label}
                label={f.label}
                value={f.value}
                missing={f.missing}
              />
            ))}
          </div>
          <div className="mt-5 space-y-5 border-t border-neutral-100 pt-5 sm:mt-0 sm:border-t-0 sm:pt-0 sm:pl-6">
            {right.map((f) => (
              <SubmissionField
                key={f.label}
                label={f.label}
                value={f.value}
                missing={f.missing}
              />
            ))}
          </div>
        </div>
      </dl>
    </SubmissionCard>
  );
}

export function SubmissionFieldRow({
  label,
  value,
  missing,
}: {
  label: string;
  value: ReactNode;
  missing?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <dt className="shrink-0 text-[13px] text-neutral-500 sm:max-w-[40%]">{label}</dt>
      <dd
        className={`min-w-0 text-sm leading-snug sm:text-right ${
          missing ? "font-medium text-amber-800" : "text-neutral-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

/** Full-width stacked field for long text (e.g. public bio). */
export function SubmissionFieldBlock({
  label,
  value,
  missing,
}: {
  label: string;
  value: ReactNode;
  missing?: boolean;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <dt className="text-[13px] text-neutral-500">{label}</dt>
      <dd
        className={`mt-2 w-full whitespace-pre-wrap text-sm leading-relaxed ${
          missing ? "font-medium text-amber-800" : "text-neutral-800"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export function SubmissionFieldRows({ fields }: { fields: AdminSubmissionField[] }) {
  const safeFields = fields ?? [];
  if (safeFields.length === 0) {
    return <p className="text-sm text-neutral-500">Nothing submitted.</p>;
  }

  return (
    <dl className="divide-y divide-neutral-100">
      {safeFields.map((f) => (
        <SubmissionFieldRow
          key={f.label}
          label={f.label}
          value={f.value}
          missing={f.missing}
        />
      ))}
    </dl>
  );
}

export function SubmissionLabelRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="border-t border-neutral-100 pt-5">
      <p className="text-[13px] font-medium text-neutral-500">{label}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
