"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { trackMixpanelPageView } from "@/lib/mixpanelClient";

function MixpanelPageViewsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    trackMixpanelPageView(qs ? `${pathname}?${qs}` : pathname);
  }, [pathname, searchParams]);

  return null;
}

/** Tracks App Router navigations as `page_viewed`. Wrap in Suspense (useSearchParams). */
export function MixpanelPageViews() {
  return (
    <Suspense fallback={null}>
      <MixpanelPageViewsInner />
    </Suspense>
  );
}
