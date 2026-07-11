"use client";

type AuditBadgeProps = {
  label: string;
  badgeClassName: string;
  className?: string;
};

export function AuditBadge({ label, badgeClassName, className = "" }: AuditBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none ${badgeClassName} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export function AuditEntityBadge({
  label,
  entityType,
  className = "",
}: {
  label: string;
  entityType: string;
  className?: string;
}) {
  const ringClass = getEntityRingClass(entityType);
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ringClass} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

function getEntityRingClass(entityType: string): string {
  switch (entityType) {
    case "booking_request":
      return "bg-sky-50 text-sky-700 ring-sky-200";
    case "dispute_case":
      return "bg-amber-50 text-amber-800 ring-amber-200";
    case "conversation":
      return "bg-cyan-50 text-cyan-800 ring-cyan-200";
    case "user":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "vendor":
      return "bg-violet-50 text-violet-800 ring-violet-200";
    case "booking_review":
      return "bg-rose-50 text-rose-800 ring-rose-200";
    case "financials":
      return "bg-lime-50 text-lime-900 ring-lime-200";
    default:
      return "bg-neutral-50 text-neutral-700 ring-neutral-200";
  }
}
