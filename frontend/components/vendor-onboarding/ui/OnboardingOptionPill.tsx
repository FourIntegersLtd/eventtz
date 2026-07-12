"use client";

import type { ReactNode } from "react";

type Props = {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  description?: string;
};

export function OnboardingOptionPill({ active, onClick, children, description }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl px-4 py-3.5 text-left text-sm shadow-sm ring-1 transition ${
        active
          ? "bg-primary/5 font-medium text-neutral-900 ring-primary/40"
          : "bg-white text-neutral-800 ring-neutral-200/50 hover:bg-neutral-50"
      }`}
    >
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          active ? "border-primary bg-primary" : "border-neutral-300 bg-white"
        }`}
        aria-hidden
      >
        {active ? (
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block leading-snug">{children}</span>
        {description ? (
          <span className="mt-0.5 block text-xs font-normal text-neutral-500">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
