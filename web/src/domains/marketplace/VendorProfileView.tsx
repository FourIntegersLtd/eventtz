"use client";

/**
 * Public vendor profile. Guests and signed-in clients share this view.
 * Package selection stays here so the booking modal (piece 02) can read it.
 * "Request booking" only flips the page's open flag; it does not submit.
 */
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Spinner } from "@/foundation/ui";
import { useSession } from "@/foundation/session";
import { vendorBrowseCategoryLabel } from "./browseLabels";
import { payloadStringField } from "./browseVendorFacts";
import { vendorMatchesMarketplaceSearch } from "./marketplaceVendorMatch";
import {
  buildMarketplaceSearchUrl,
  clientSearchContextFromBrowse,
  eventEnquirePrefillFromMarketplaceState,
  marketplaceSearchPrefillFromState,
  marketplaceStateFromSearchParams,
} from "./marketplaceSearchParams";
import { useExploreVendor } from "./useExploreVendor";
import { useMarketplaceBookmarks } from "./useMarketplaceBookmarks";
import { usePerUnitPackageSelection } from "./usePerUnitPackageSelection";
import { useVendorReferralPreview } from "./useVendorReferralPreview";
import { VendorProfileBody } from "./VendorProfileBody";
import { VendorProfileBreadcrumb } from "./VendorProfileBreadcrumb";
import {
  buildBrowsePricingOptions,
  formatBookingTotalGbp,
  type BrowsePricingOption,
} from "./vendorBrowseDetailModel";
import {
  captureVendorReferralFromSearchParams,
  getStoredVendorReferralCode,
  readVendorReferralFromUrl,
} from "./vendorReferralAttribution";

/** Arguments the booking modal receives when the panel is open. */
export type VendorProfileBookingSlotArgs = {
  open: boolean;
  close: () => void;
  pricingOptions: BrowsePricingOption[];
  selectedIds: string[];
  quantities: Record<string, number>;
  vendorDisplayName: string;
  vendorPayload: Record<string, unknown>;
  searchPrefill: ReturnType<typeof marketplaceSearchPrefillFromState>;
  initialPrefill: ReturnType<typeof eventEnquirePrefillFromMarketplaceState>;
  linkedEventId: string | null;
  clientSearchContext: ReturnType<typeof clientSearchContextFromBrowse>;
  initialReferralCode: string | null;
};

type VendorProfileViewProps = {
  vendorUserId: string;
  /** Owned by the route. This piece renders nothing until `bookingModal` is passed. */
  bookingOpen: boolean;
  onRequestBooking: () => void;
  onCloseBooking: () => void;
  bookingModal?: (args: VendorProfileBookingSlotArgs) => ReactNode;
};

/** Top-level vendor profile, including loading, missing, and error states. */
export function VendorProfileView({
  vendorUserId,
  bookingOpen,
  onRequestBooking,
  onCloseBooking,
  bookingModal,
}: VendorProfileViewProps) {
  const searchParams = useSearchParams();
  const { session } = useSession();
  const { vendor, loading, error, notFound } = useExploreVendor(vendorUserId);
  const bookmarks = useMarketplaceBookmarks();
  const [bookingSelectError, setBookingSelectError] = useState(false);

  const searchKey = searchParams.toString();
  const referralFromUrl = readVendorReferralFromUrl(new URLSearchParams(searchKey));
  useEffect(() => {
    if (!vendorUserId) return;
    captureVendorReferralFromSearchParams(vendorUserId, new URLSearchParams(searchKey));
  }, [vendorUserId, searchKey]);

  const referralCode =
    referralFromUrl ?? (vendorUserId ? getStoredVendorReferralCode(vendorUserId) : null);

  const marketplaceSearch = useMemo(
    () => marketplaceStateFromSearchParams(searchParams),
    [searchParams],
  );
  const browseListHref = useMemo(
    () => buildMarketplaceSearchUrl("/client/browse", marketplaceSearch),
    [marketplaceSearch],
  );
  const detailPath = useMemo(
    () =>
      vendorUserId
        ? buildMarketplaceSearchUrl(`/client/browse/${vendorUserId}`, marketplaceSearch)
        : browseListHref,
    [vendorUserId, marketplaceSearch, browseListHref],
  );

  const payload = vendorPayload(vendor);
  const pricingOptions = useMemo(
    () => (vendor ? buildBrowsePricingOptions(vendor) : []),
    [vendor],
  );
  const selection = usePerUnitPackageSelection({
    pricingOptions,
    onSelectionChange: () => setBookingSelectError(false),
  });
  const selectedTotal = useMemo(
    () => formatBookingTotalGbp(selection.lineItems),
    [selection.lineItems],
  );
  const referral = useVendorReferralPreview({
    vendorUserId: vendor?.user_id ?? vendorUserId,
    vendorPortionGbp: selectedTotal.sumNumeric,
    initialCode: referralCode,
  });

  const isClient = session?.user.user_type === "client";
  const requireLogin = !session;
  const businessName = payloadStringField(payload, "businessName").trim() || "Vendor";
  const primaryService = stringList(payload.servicesOffered)[0];
  const categoryLabel = vendorBrowseCategoryLabel(primaryService);
  const categoryBrowseHref = primaryService
    ? buildMarketplaceSearchUrl("/client/browse", { ...marketplaceSearch, types: [primaryService], page: 1 })
    : browseListHref;

  const mismatchReasons = useMemo(() => {
    if (!vendor) return null;
    const { matches, reasons } = vendorMatchesMarketplaceSearch(vendor, marketplaceSearch);
    if (matches || reasons.length === 0) return null;
    return reasons;
  }, [vendor, marketplaceSearch]);

  const registerHref = withAuthReturn("/register?type=client", detailPath, vendorUserId);
  const loginHref = withAuthReturn("/login", detailPath, vendorUserId);
  const messageHref = `/client/messages?vendor=${encodeURIComponent(vendorUserId)}`;

  const requestBooking = () => {
    if (selection.selectedIds.size === 0) {
      setBookingSelectError(true);
      return;
    }
    onRequestBooking();
  };

  if (!vendorUserId) {
    return <p className="text-center text-sm text-neutral-600">Invalid link.</p>;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 md:mb-6">
        <div className="hidden md:block">
          <Link href={browseListHref} className="text-sm font-medium text-neutral-500 hover:text-neutral-800">
            ← Back to browse
          </Link>
        </div>
        {vendor ? (
          <VendorProfileBreadcrumb
            browseHref={browseListHref}
            categoryHref={categoryBrowseHref}
            categoryLabel={categoryLabel}
            vendorName={businessName}
            className="md:hidden"
          />
        ) : null}
      </div>

      {loading ? (
        <div className="py-12">
          <Spinner label="Loading vendor…" />
        </div>
      ) : error ? (
        <p className="text-sm text-red-700">{error}</p>
      ) : notFound || !vendor ? (
        <div className="flex flex-col items-center space-y-4 text-center">
          <p className="text-sm text-neutral-700">This vendor could not be found or is no longer listed.</p>
          <Link href={browseListHref} className="text-sm font-medium text-primary hover:underline">
            Back to browse
          </Link>
        </div>
      ) : (
        <>
          {mismatchReasons ? (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">This vendor doesn&apos;t match your search filters</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900">
                {mismatchReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-800/90">
                You can still book or message them. Check dates and services first.
              </p>
            </div>
          ) : null}
          <VendorProfileBody
            vendor={vendor}
            pricingOptions={pricingOptions}
            selectedIds={selection.selectedIds}
            quantities={selection.quantities}
            lineItems={selection.lineItems}
            referralDiscountGbp={referral.referralDiscountGbp}
            onTogglePackage={selection.togglePackage}
            onPackageQuantity={selection.setPackageQuantity}
            showBookingActions={isClient}
            requireLogin={requireLogin}
            registerHref={registerHref}
            loginHref={loginHref}
            messageHref={messageHref}
            continueHref={browseListHref}
            bookingSelectError={bookingSelectError}
            onRequestBooking={requestBooking}
            bookmarked={bookmarks.isSaved(vendor.user_id)}
            onToggleBookmark={() => bookmarks.toggle(vendor.user_id)}
          />
          {bookingOpen
            ? bookingModal?.({
                open: bookingOpen,
                close: onCloseBooking,
                pricingOptions,
                selectedIds: selection.selectedIdList,
                quantities: selection.quantities,
                vendorDisplayName: businessName,
                vendorPayload: payload,
                searchPrefill: marketplaceSearchPrefillFromState(marketplaceSearch),
                initialPrefill: eventEnquirePrefillFromMarketplaceState(marketplaceSearch),
                linkedEventId: marketplaceSearch.linkedEventId,
                clientSearchContext: clientSearchContextFromBrowse(
                  marketplaceSearch,
                  new URLSearchParams(searchKey),
                ),
                initialReferralCode: referralCode,
              })
            : null}
        </>
      )}
    </>
  );
}

function withAuthReturn(href: string, returnPath: string, vendorUserId: string): string {
  const [path, existingQuery] = href.split("?");
  const params = new URLSearchParams(existingQuery ?? "");
  params.set("next", returnPath);
  params.set("vendor", vendorUserId);
  return `${path}?${params.toString()}`;
}

function vendorPayload(vendor: { profile_form_data?: Record<string, unknown> | null } | undefined) {
  const payload = vendor?.profile_form_data;
  if (typeof payload === "object" && payload !== null && !Array.isArray(payload)) return payload;
  return {};
}

function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.map((entry) => String(entry)) : [];
}
