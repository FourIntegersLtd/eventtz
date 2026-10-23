"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { TONE } from "@/components/ui/tokens";
import { BackLink } from "@/components/ui/BackLink";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { LoadingState } from "@/components/ui/LoadingState";
import { useToast } from "@/components/ui/Toast";
import { MarketplaceBrowseShell } from "@/features/marketplace/MarketplaceBrowseShell";
import {
  VendorBookingModal,
  type VendorBookingSearchPrefill,
} from "@/features/client/browse/VendorBookingModal";
import { VendorBrowseDetailBody } from "@/features/client/browse/VendorBrowseDetailBody";
import {
  VendorBrowseBreadcrumb,
  vendorBrowseCategoryLabel,
} from "@/features/client/browse/VendorBrowseBreadcrumb";
import { ChatDrawer } from "@/features/chat/ChatDrawer";
import { buildBrowsePricingOptions } from "@/lib/vendorBrowseDetailModel";
import { useExploreVendor } from "@/features/client/browse/useExploreVendor";
import {
  buildMarketplaceSearchUrl,
  clientSearchContextFromBrowse,
  marketplaceSearchPrefillFromState,
  marketplaceStateFromSearchParams,
} from "@/lib/marketplaceSearchParams";
import { payloadStringField } from "@/lib/vendorPayload";
import { eventEnquirePrefillFromSearchParams } from "@/features/bookings/eventEnquirePrefill";
import { CLIENT_BOOKING_TOAST_COPY } from "@/features/bookings/bookingConfirmCopy";
import { useLaunchingSoonBookingGuard } from "@/features/bookings/useLaunchingSoonBookingGuard";
import { vendorMatchesMarketplaceSearch } from "@/lib/marketplaceVendorMatch";
import { usualReplyExpectation } from "@/lib/vendorMetrics";
import { captureVendorReferralFromSearchParams } from "@/lib/vendorReferralAttribution";

/** Client browse vendor detail: portal shell for clients, public chrome otherwise. */
export function ClientVendorBrowseDetailView() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const { user, loading: authLoading } = useAuth();
  const { vendor, loading, error, notFound } = useExploreVendor(userId);
  const { showToast } = useToast();
  const [chatOpen, setChatOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSelectionIds, setBookingSelectionIds] = useState<string[]>([]);
  const [bookingQuantities, setBookingQuantities] = useState<Record<string, number>>(
    {},
  );
  const { guardBooking, launchingSoonModal } = useLaunchingSoonBookingGuard();
  const [storedReferralCode, setStoredReferralCode] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const code = captureVendorReferralFromSearchParams(userId, searchParams);
    setStoredReferralCode(code);
  }, [userId, searchParams]);

  const marketplaceSearch = useMemo(
    () => marketplaceStateFromSearchParams(searchParams),
    [searchParams],
  );

  /** Keep plan/simple search filters when returning to the list. */
  const browseListHref = useMemo(
    () => buildMarketplaceSearchUrl("/client/browse", marketplaceSearch),
    [marketplaceSearch],
  );

  const detailPath = useMemo(
    () =>
      userId
        ? buildMarketplaceSearchUrl(`/client/browse/${userId}`, marketplaceSearch)
        : browseListHref,
    [userId, marketplaceSearch, browseListHref],
  );

  const businessName = useMemo(() => {
    const p = vendor?.profile_form_data ?? {};
    return payloadStringField(p, "businessName").trim() || "Vendor";
  }, [vendor]);

  const pricingOptions = useMemo(
    () => (vendor ? buildBrowsePricingOptions(vendor) : []),
    [vendor],
  );

  const bookingSearchPrefill = useMemo(
    (): VendorBookingSearchPrefill => marketplaceSearchPrefillFromState(marketplaceSearch),
    [marketplaceSearch],
  );

  const plannerEventPrefill = useMemo(
    () => eventEnquirePrefillFromSearchParams(searchParams),
    [searchParams],
  );

  const linkedEventId = searchParams.get("event_id")?.trim() || null;

  const bookingClientSearchContext = useMemo(
    () => clientSearchContextFromBrowse(marketplaceSearch, searchParams),
    [marketplaceSearch, searchParams],
  );

  const marketplaceSearchMismatchReasons = useMemo(() => {
    if (!vendor) return null;
    const { matches, reasons } = vendorMatchesMarketplaceSearch(vendor, marketplaceSearch);
    if (matches || reasons.length === 0) return null;
    return reasons;
  }, [vendor, marketplaceSearch]);

  const vendorPayload = useMemo(() => {
    const p = vendor?.profile_form_data;
    return typeof p === "object" && p !== null && !Array.isArray(p)
      ? (p as Record<string, unknown>)
      : undefined;
  }, [vendor]);

  const primaryService = useMemo(() => {
    const services = vendorPayload?.servicesOffered;
    if (!Array.isArray(services) || services.length === 0) return undefined;
    return String(services[0]);
  }, [vendorPayload]);

  const categoryLabel = useMemo(
    () => vendorBrowseCategoryLabel(primaryService),
    [primaryService],
  );

  const categoryBrowseHref = useMemo(() => {
    if (!primaryService) return browseListHref;
    return buildMarketplaceSearchUrl("/client/browse", {
      ...marketplaceSearch,
      types: [primaryService],
      page: 1,
    });
  }, [browseListHref, marketplaceSearch, primaryService]);

  useEffect(() => {
    if (!vendor?.user_id) return;
    track(MixpanelEvents.vendor_profile_viewed, {
      vendor_user_id: vendor.user_id,
      authenticated: Boolean(user?.id),
      user_type: user?.user_type ?? "anonymous",
    });
  }, [vendor?.user_id, user?.id, user?.user_type]);

  const isClient = user?.user_type === "client";

  const headerBar = (
    <div className="mb-4 flex flex-wrap items-center gap-3 md:mb-6">
      <div className="hidden md:block">
        <BackLink href={browseListHref} label="Back to browse" tone="muted" />
      </div>
      {vendor ? (
        <VendorBrowseBreadcrumb
          browseHref={browseListHref}
          categoryHref={categoryBrowseHref}
          categoryLabel={categoryLabel}
          vendorName={businessName}
          className="md:hidden"
        />
      ) : null}
    </div>
  );

  if (!userId) {
    const invalid = <p className="text-center text-sm text-ink-2">Invalid link.</p>;
    return isClient ? invalid : <MarketplaceBrowseShell width="detail">{invalid}</MarketplaceBrowseShell>;
  }

  const mainContent = (() => {
    if (loading || authLoading) {
      return <LoadingState label="Loading vendor…" variant="centered" className="py-12" branded />;
    }
    if (error) {
      return <LottieFailureInline message={error} />;
    }
    if (notFound || !vendor) {
      return (
        <div className="flex flex-col items-center space-y-4 text-center">
          <LottieIllustration asset="notFound" className="h-32 w-32" />
          <p className="text-sm text-ink-2">
            This vendor could not be found or is no longer listed.
          </p>
          <BackLink href={browseListHref} label="Back to browse" />
        </div>
      );
    }

    return (
      <>
        {marketplaceSearchMismatchReasons ? (
          <div className={`mb-4 rounded-control border px-4 py-3 text-sm ${TONE.warning.background} ${TONE.warning.line} ${TONE.warning.text}`}>
            <p className="font-semibold">This vendor doesn't match your search filters</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              {marketplaceSearchMismatchReasons.map((r, i) => (
                <li key={`${i}-${r.slice(0, 40)}`}>{r}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs opacity-90">
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
          storedReferralCode={storedReferralCode}
          onContinue={() => router.push(browseListHref)}
          onRequestBooking={
            isClient
              ? (ids, quantities) => {
                  guardBooking(() => {
                    setBookingSelectionIds(ids);
                    setBookingQuantities(quantities);
                    setBookingOpen(true);
                    track(MixpanelEvents.enquiry_started, { vendor_user_id: userId });
                  });
                }
              : undefined
          }
          onContactVendor={() => setChatOpen(true)}
        />
        {user && bookingOpen && vendor ? (
          <VendorBookingModal
            key={`${bookingSelectionIds.slice().sort().join("|")}|${JSON.stringify(bookingQuantities)}|${searchParams.toString()}`}
            onClose={() => setBookingOpen(false)}
            onSuccess={(bookingId) => {
              setBookingOpen(false);
              showToast({
                title: CLIENT_BOOKING_TOAST_COPY.requestSent,
                description: `${businessName} will be notified. ${usualReplyExpectation(vendor.avg_response_seconds)}`,
                tone: "success",
              });
              router.push(`/client/bookings/${bookingId}`);
            }}
            vendorDisplayName={businessName}
            vendorUserId={userId}
            pricingOptions={pricingOptions}
            initialSelectedIds={bookingSelectionIds}
            initialQuantities={bookingQuantities}
            vendorPayload={vendorPayload}
            searchPrefill={bookingSearchPrefill}
            initialPrefill={plannerEventPrefill}
            linkedEventId={linkedEventId}
            clientSearchContext={bookingClientSearchContext}
            initialReferralCode={storedReferralCode}
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
        {launchingSoonModal}
      </>
    );
  })();

  return isClient ? (
    <>
      {headerBar}
      {mainContent}
    </>
  ) : (
    <MarketplaceBrowseShell width="detail">
      {headerBar}
      {mainContent}
    </MarketplaceBrowseShell>
  );
}
