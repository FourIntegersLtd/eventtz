"use client";

import {
  VENDOR_DESIGN_FIXTURE_HTML,
  type VendorDesignFixtureId,
} from "@/features/vendor/design/vendorDesignFixtureHtml";

type VendorDesignDiffFixtureViewProps = {
  fixtureId: VendorDesignFixtureId;
};

/**
 * Renders transcribed artboard markup for design-diff (``designStatic=1`` + ``designFixture``).
 * Uses ez-* classes only; HTML is generated from canvas artboards.
 */
export function VendorDesignDiffFixtureView({ fixtureId }: VendorDesignDiffFixtureViewProps) {
  const fixture = VENDOR_DESIGN_FIXTURE_HTML[fixtureId];
  if (!fixture) return null;

  if (fixture.scrim) {
    return (
      <div style={{ position: "relative" }}>
        <div className="ez-backdrop-page">
          <div dangerouslySetInnerHTML={{ __html: fixture.content }} />
        </div>
        <div dangerouslySetInnerHTML={{ __html: fixture.scrim }} />
      </div>
    );
  }

  return <div dangerouslySetInnerHTML={{ __html: fixture.content }} />;
}
