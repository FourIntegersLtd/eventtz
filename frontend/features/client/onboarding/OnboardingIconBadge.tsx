"use client";

import type { OnboardingIconVisual } from "@/features/client/onboarding/clientOnboardingVisuals";

type Props = {
  visual: OnboardingIconVisual;
  size?: "md" | "lg" | "xl";
};

const SIZE_CLASSES = {
  md: { shell: "h-14 w-14 rounded-xl", icon: "h-6 w-6" },
  lg: { shell: "h-20 w-20 rounded-2xl", icon: "h-9 w-9" },
  xl: { shell: "h-24 w-24 rounded-2xl", icon: "h-11 w-11" },
} as const;

export function OnboardingIconBadge({ visual, size = "xl" }: Props) {
  const { Icon } = visual;
  const sizes = SIZE_CLASSES[size];

  return (
    <div
      className={`flex items-center justify-center ${sizes.shell} ${visual.shell}`}
    >
      <Icon className={`${sizes.icon} ${visual.icon}`} strokeWidth={1.75} aria-hidden />
    </div>
  );
}
