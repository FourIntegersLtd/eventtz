"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { PortalShell } from "@/components/portal-shell/PortalShell";
import { BackLink } from "@/components/ui/BackLink";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";
import {
  VendorBookingModal,
  type VendorBookingSearchPrefill,
} from "@/features/client/browse/VendorBookingModal";
import { VendorBrowseDetailBody } from "@/features/client/browse/VendorBrowseDetailBody";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { buildBrowsePricingOptions } from "@/features/client/browse/vendorBrowseDetailModel";
import { useExploreVendor } from "@/features/client/browse/useExploreVendor";
import { marketplaceStateFromSearchParams } from "@/lib/marketplaceSearchParams";
import { vendorMatchesMarketplaceSearch } from "@/lib/marketplaceVendorMatch";

function payloadStr(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  return typeof v === "string" ? v : "";
}

/** Client browse vendor detail: portal shell for clients, public chrome otherwise. */
export function ClientVendorBrowseDetailView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const { user, loading: authLoading, signOut } = useAuth();
  const { vendor, loading, error, notFound } = useExploreVendor(userId);
  const { showToast } = useToast();
  const [chatOpen, setChatOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSelectionIds, setBookingSelectionIds] = useState<string[]>([]);

  const detailPath = useMemo(
    () => (userId ? `/client/browse/${userId}` : "/client/browse"),
    [userId],
  );

  const businessName = useMemo(() => {
    const p = vendor?.payload ?? {};
    return payloadStr(p, "businessName").trim() || "Vendor";
  }, [vendor]);

  const pricingOptions = useMemo(
    () => (vendor ? buildBrowsePricingOptions(vendor) : []),
    [vendor],
  );

  const marketplaceSearch = useMemo(
    () => marketplaceStateFromSearchParams(searchParams),
    [searchParams],
  );

  const bookingSearchPrefill = useMemo((): VendorBookingSearchPrefill => {
    const d = marketplaceSearch.dates;
    const first = d[0];
    let eventEndDate: string | undefined;
    if (d.length === 2 && first && d[1] && d[1] >= first) {
      eventEndDate = d[1];
    }
    return {
      eventDate: first ?? "",
      eventEndDate,
      datesFlexible: marketplaceSearch.dateFlexible,
    };
  }, [marketplaceSearch]);

  const marketplaceSearchMismatchReasons = useMemo(() => {
    if (!vendor) return null;
    const { matches, reasons } = vendorMatchesMarketplaceSearch(vendor, marketplaceSearch);
    if (matches || reasons.length === 0) return null;
    return reasons;
  }, [vendor, marketplaceSearch]);

  const vendorPayload = useMemo(() => {
    const p = vendor?.payload;
    return typeof p === "object" && p !== null && !Array.isArray(p)
      ? (p as Record<string, unknown>)
      : undefined;
  }, [vendor]);

  const isClient = user?.user_type === "client";
  const logoHref = isClient ? "/client/dashboard" : "/";

  const headerBar = (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <BackLink href="/client/browse" label="Back to browse" tone="muted" />
      {!user ? (
        <Link
          href="/"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
        >
          Home
        </Link>
      ) : null}
    </div>
  );

  if (!userId) {
    return (
      <main className="min-h-screen bg-auth-bg px-4 py-10">
        <p className="text-center text-sm text-neutral-600">Invalid link.</p>
      </main>
    );
  }

  const mainContent = (() => {
    if (loading || authLoading) {
      return <LoadingState label="Loading vendor…" variant="centered" className="py-12" />;
    }
    if (error) {
      return (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      );
    }
    if (notFound || !vendor) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            This vendor could not be found or is no longer listed.
          </p>
          <BackLink href="/client/browse" label="Back to browse" />
        </div>
      );
    }

    return (
      <>
        {marketplaceSearchMismatchReasons ? (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">This vendor doesn't match your search filters</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900">
              {marketplaceSearchMismatchReasons.map((r, i) => (
                <li key={`${i}-${r.slice(0, 40)}`}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-800/90">
              You can still book or message them. Check dates and services first.
            </p>
          </div>
        ) : null}
        <VendorBrowseDetailBody
          vendor={vendor}
          requireLoginForActions={!user}
          loginHref="/login"
          registerHref="/register?type=client"
          detailReturnPath={detailPath}
          onContinue={() => router.push("/client/browse")}
          onRequestBooking={
            isClient
              ? (ids) => {
                  setBookingSelectionIds(ids);
                  setBookingOpen(true);
                }
              : undefined
          }
          onContactVendor={() => setChatOpen(true)}
        />
        {user && bookingOpen && vendor ? (
          <VendorBookingModal
            key={`${bookingSelectionIds.slice().sort().join("|")}|${searchParams.toString()}`}
            onClose={() => setBookingOpen(false)}
            onSuccess={(bookingId) => {
              setBookingOpen(false);
              showToast({
                title: "Request sent",
                description: `${businessName} will be notified.`,
                tone: "success",
              });
              router.push(`/client/bookings/${bookingId}`);
            }}
            vendorDisplayName={businessName}
            vendorUserId={userId}
            pricingOptions={pricingOptions}
            initialSelectedIds={bookingSelectionIds}
            vendorPayload={vendorPayload}
            searchPrefill={bookingSearchPrefill}
          />
        ) : null}
        {user ? (
          <ChatDrawer
            isOpen={chatOpen}
            onClose={() => setChatOpen(false)}
            portal="client"
            counterpartyName={businessName}
            counterpartyUserId={userId}
          />
        ) : null}
      </>
    );
  })();

  // Signed-in clients keep the portal shell (sidebar, notification bell, sign-out) throughout —
  // it should never disappear just because they navigated into a vendor's profile.
  if (isClient) {
    return (
      <PortalShell portal="client" title={businessName}>
        <div className="mx-auto w-full min-w-0 max-w-6xl">
          {headerBar}
          {mainContent}
        </div>
      </PortalShell>
    );
  }

  return (
    <main className="min-h-dvh bg-auth-bg">
      <header className="border-b border-neutral-200/60 bg-auth-bg/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-12">
        <div className="mx-auto flex min-w-0 max-w-6xl flex-wrap items-center justify-between gap-3">
          <EventtzLogo priority href={logoHref} />
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm">
            {!user ? (
              <>
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
                <Link
                  href={`/register?type=client&next=${encodeURIComponent(detailPath)}`}
                  className="rounded-lg bg-primary px-3 py-1.5 font-semibold text-white hover:opacity-95"
                >
                  Create account
                </Link>
              </>
            ) : (
              <>
                <Link href="/" className="font-medium text-neutral-700 hover:underline">
                  Home
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void signOut().then(() => router.replace("/login"));
                  }}
                  className="font-medium text-neutral-600 hover:text-neutral-900 hover:underline"
                >
                  Sign out
                </button>
              </>
            )}
          </nav>
        </div>
      </header>
      <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {headerBar}
        {mainContent}
      </div>
    </main>
  );
}
