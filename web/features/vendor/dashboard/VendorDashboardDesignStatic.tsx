"use client";

import { useState } from "react";
import Link from "next/link";
import { MessageCircle, Calendar, Wallet, Activity } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { copyToClipboard } from "@/lib/copyToClipboard";
import type { VendorBookingListItem } from "@/lib/vendorBookingsApi";
import { VendorEzPageHead } from "@/features/vendor/ui/VendorEzPageHead";
import type { VendorAnalytics } from "@/lib/vendorAnalyticsApi";
import { vendorDashboardAnalyticsSlice } from "@/features/vendor/dashboard/vendorDashboardAnalytics";
import {
  buildDashboardMonthGrid,
  formatDashboardMonthTitle,
} from "@/features/vendor/dashboard/vendorDashboardCalendar";
import type { VendorBookingsByDate } from "@/features/vendor/dashboard/useVendorDashboard";

type VendorDashboardDesignStaticProps = {
  greetingName: string;
  pendingEnquiries: number;
  confirmedBookings: number;
  needsResponse: VendorBookingListItem[];
  analytics: VendorAnalytics | null;
  bookingsByDate: VendorBookingsByDate;
  /** Absolute client-facing listing URL to copy, for example `https://www.eventtz.com/client/browse/{id}`. */
  publicProfileHref?: string | null;
  onCalendarDaySelect?: (dateKey: string) => void;
};

/** Vendor dashboard (design V14) with live API data. */
export function VendorDashboardDesignStatic({
  greetingName,
  pendingEnquiries,
  confirmedBookings,
  needsResponse,
  analytics,
  bookingsByDate,
  publicProfileHref,
  onCalendarDaySelect,
}: VendorDashboardDesignStaticProps) {
  const { showToast } = useToast();
  const [profileCopied, setProfileCopied] = useState(false);
  const showEnquiryBanner = pendingEnquiries > 0;
  const analyticsSlice = vendorDashboardAnalyticsSlice(analytics);
  const viewMonth = new Date();
  const bookedKeys = new Set(Object.keys(bookingsByDate));
  const calendarCells = buildDashboardMonthGrid(viewMonth, bookedKeys);

  return (
    <div className="ez-stack ez-stack--lg">
      <VendorEzPageHead
        eyebrow="Welcome back"
        title={`Good morning, ${greetingName}`}
        description="Here is what needs you today."
        actions={
          publicProfileHref ? (
            <button
              type="button"
              className="ez-btn ez-btn--secondary"
              onClick={() => {
                void copyToClipboard(publicProfileHref).then((copied) => {
                  if (!copied) {
                    showToast({ title: "Could not copy the link", tone: "error" });
                    return;
                  }
                  setProfileCopied(true);
                  showToast({
                    title: "Profile link copied",
                    description: "Paste it anywhere you want people to see your page.",
                    tone: "success",
                  });
                  window.setTimeout(() => setProfileCopied(false), 2000);
                });
              }}
            >
              {profileCopied ? "Link copied" : "Share my profile"}
            </button>
          ) : null
        }
      />

      {showEnquiryBanner ? (
        <div className="ez-banner ez-banner--warning">
          <Activity size={20} strokeWidth={1.75} aria-hidden />
          <div className="ez-banner__body">
            <div className="ez-banner__title">
              {pendingEnquiries} {pendingEnquiries === 1 ? "enquiry is" : "enquiries are"} waiting for a reply
            </div>
            <p className="ez-small" style={{ color: "inherit" }}>
              Vendors who reply within 24 hours get more bookings.
            </p>
          </div>
          <div className="ez-banner__actions">
            <Link className="ez-btn ez-btn--primary" href="/vendor/bookings">
              Review enquiries
            </Link>
          </div>
        </div>
      ) : null}

      <div className="ez-grid-4">
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
            Pending enquiries
          </span>
          <span className="ez-kpi__value">{pendingEnquiries}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Calendar size={16} strokeWidth={1.75} aria-hidden />
            Upcoming events
          </span>
          <span className="ez-kpi__value">{confirmedBookings}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Wallet size={16} strokeWidth={1.75} aria-hidden />
            Earned this month
          </span>
          <span className="ez-kpi__value">{analyticsSlice.earnedThisMonthLabel}</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Activity size={16} strokeWidth={1.75} aria-hidden />
            Avg response
          </span>
          <span className="ez-kpi__value">{analyticsSlice.avgResponseLabel}</span>
        </div>
      </div>

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Needs your attention</span>
              <Link className="ez-btn ez-btn--ghost ez-btn--sm" href="/vendor/bookings">
                All bookings
              </Link>
            </div>
            <div className="ez-card__body ez-stack ez-stack--sm">
              {needsResponse.length === 0 ? (
                <p className="ez-small">No enquiries need a reply right now.</p>
              ) : (
                needsResponse.map((enquiry) => (
                  <div className="ez-list-row" key={enquiry.booking_request_id}>
                    <span className="ez-icon-tile ez-icon-tile--gold">
                      <MessageCircle size={20} strokeWidth={1.75} aria-hidden />
                    </span>
                    <div className="ez-list-row__main">
                      <span className="ez-strong">
                        {enquiry.client_email ? `${enquiry.client_email}, ` : ""}
                        {enquiry.event_name}
                      </span>
                      <span className="ez-small">{enquiry.event_date}</span>
                    </div>
                    <span className="ez-badge ez-badge--warning">Pending</span>
                    <Link
                      className="ez-btn ez-btn--primary ez-btn--sm"
                      href={`/vendor/bookings/${encodeURIComponent(enquiry.booking_request_id)}`}
                    >
                      Respond
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Earnings, last 6 months</span>
            </div>
            <div className="ez-card__body">
              {analyticsSlice.revenueBars.length === 0 ? (
                <p className="ez-small">Complete bookings to see earnings here.</p>
              ) : (
                <div className="ez-bar-chart">
                  {analyticsSlice.revenueBars.map((bar) => (
                    <div className="ez-bar-chart__col" key={bar.label}>
                      <span className="ez-caption">{bar.valueLabel}</span>
                      <div className="ez-bar" style={{ height: `${bar.heightPx}px` }} />
                      <span className="ez-caption">{bar.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">{formatDashboardMonthTitle(viewMonth)}</span>
            </div>
            <div className="ez-card__body">
              <div className="ez-cal">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dow) => (
                  <div className="ez-cal__dow" key={dow}>
                    {dow}
                  </div>
                ))}
                {calendarCells.map((cell, index) => {
                  if (cell.day == null || !cell.dateKey) {
                    return <div className="ez-cal__day ez-cal__day--muted" key={`pad-${index}`} />;
                  }
                  const booked = cell.booked;
                  const className = `ez-cal__day${booked ? " ez-cal__day--booked" : ""}`;
                  if (booked && onCalendarDaySelect) {
                    return (
                      <button
                        type="button"
                        className={className}
                        key={cell.dateKey}
                        onClick={() => onCalendarDaySelect(cell.dateKey!)}
                      >
                        {cell.day}
                      </button>
                    );
                  }
                  return (
                    <div className={className} key={cell.dateKey}>
                      {cell.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
