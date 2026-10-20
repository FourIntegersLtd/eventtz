"use client";

import type { ReactNode } from "react";
import { VendorDesignDiffFixtureView } from "@/features/vendor/design/VendorDesignDiffFixtureView";
import {
  useDesignDiffFixture,
  useDesignDiffStatic,
} from "@/features/vendor/design/useDesignDiffStatic";
import type { VendorDesignFixtureId } from "@/features/vendor/design/vendorDesignFixtureHtml";

/**
 * When design-diff is active for a route, returns the fixture view; otherwise null so the caller
 * can render the live screen.
 */
export function useVendorDesignDiffFixture(defaultFixtureId?: VendorDesignFixtureId): ReactNode | null {
  const designStatic = useDesignDiffStatic();
  const paramFixture = useDesignDiffFixture();
  if (!designStatic) return null;
  const fixtureId = paramFixture ?? defaultFixtureId ?? null;
  if (!fixtureId) return null;
  return <VendorDesignDiffFixtureView fixtureId={fixtureId} />;
}

type VendorDesignDiffPageGateProps = {
  fixtureId: VendorDesignFixtureId;
  children: ReactNode;
};

/** Renders the artboard fixture when ``designStatic=1`` (and optional ``designFixture``). */
export function VendorDesignDiffPageGate({ fixtureId, children }: VendorDesignDiffPageGateProps) {
  const fixture = useVendorDesignDiffFixture(fixtureId);
  if (fixture) return fixture;
  return children;
}
