import type { ReactNode } from "react";

export function labelClass() {
  return "block text-sm font-medium text-neutral-700 mb-1.5";
}

export function inputClass() {
  return "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm outline-none ring-primary/20 focus:border-primary focus:ring-2";
}

export function ToggleChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300"
      }`}
    >
      {children}
    </button>
  );
}
