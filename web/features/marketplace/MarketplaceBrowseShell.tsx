import type { ReactNode } from "react";
import { LandingNav } from "@/components/landing/LandingNav";

type MarketplaceBrowseShellProps = {
  children: ReactNode;
  /** Wider results grid on list pages; vendor detail uses extra page width for the pricing column. */
  width?: "default" | "wide" | "detail";
};

/** Shared top nav + page chrome for public marketplace routes (`/client/browse`, vendor detail). */
export function MarketplaceBrowseShell({
  children,
  width = "wide",
}: MarketplaceBrowseShellProps) {
  const maxWidth =
    width === "detail"
      ? "max-w-[90rem]"
      : width === "wide"
        ? "max-w-7xl"
        : "max-w-6xl";

  return (
    <div className="min-h-dvh bg-page-bg text-ink">
      <LandingNav variant="solid" />
      <main
        className={`page-inline-gutter mx-auto w-full ${maxWidth} pb-8 pt-24 sm:pb-10 sm:pt-28`}
      >
        {children}
      </main>
    </div>
  );
}
