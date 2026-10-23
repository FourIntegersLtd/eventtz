"use client";

import { useState } from "react";
import { MessageCircle, Calendar, Wallet, Activity } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import { copyToClipboard } from "@/lib/copyToClipboard";
import type { VendorBookingListItem } from "@/lib/vendorBookingsApi";
import { PageHeader } from "@/components/ui/PageHeader";
import type { VendorAnalytics } from "@/lib/vendorAnalyticsApi";
import { vendorDashboardAnalyticsSlice } from "@/features/vendor/dashboard/vendorDashboardAnalytics";
import {
  buildDashboardMonthGrid,
  formatDashboardMonthTitle,
} from "@/features/vendor/dashboard/vendorDashboardCalendar";
import type { VendorBookingsByDate } from "@/features/vendor/dashboard/useVendorDashboard";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Card } from "@/components/ui/Card";
import { Banner } from "@/components/ui/Banner";
import { StatTile } from "@/components/ui/StatTile";
import { Button } from "@/components/ui/Button";

type VendorDashboardEzViewProps = {
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
export function VendorDashboardEzView({
  greetingName,
  pendingEnquiries,
  confirmedBookings,
  needsResponse,
  analytics,
  bookingsByDate,
  publicProfileHref,
  onCalendarDaySelect,
}: VendorDashboardEzViewProps) {
  const { showToast } = useToast();
  const [profileCopied, setProfileCopied] = useState(false);
  const showEnquiryBanner = pendingEnquiries > 0;
  const analyticsSlice = vendorDashboardAnalyticsSlice(analytics);
  const viewMonth = new Date();
  const bookedKeys = new Set(Object.keys(bookingsByDate));
  const calendarCells = buildDashboardMonthGrid(viewMonth, bookedKeys);

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader descriptionSize="body"
        eyebrow="Welcome back"
        title={`Good morning, ${greetingName}`}
        description="Here is what needs you today."
        actions={
          publicProfileHref ? (
            <Button
              variant="secondary"
              type="button"

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
              }}>
              {profileCopied ? "Link copied" : "Share my profile"}
            </Button>
          ) : null
        }
      />

      {showEnquiryBanner ? (
        <Banner
          tone="warning"
          icon={<Activity size={20} strokeWidth={1.75} aria-hidden />}
          title={`${pendingEnquiries} ${pendingEnquiries === 1 ? "enquiry is" : "enquiries are"} waiting for a reply`}
          action={<ButtonLink href="/vendor/bookings">Review enquiries</ButtonLink>}>
          <p className="ez-small text-inherit">
            Vendors who reply within 24 hours get more bookings.
          </p>
        </Banner>
      ) : null}

      <div className="ez-grid-4">
        <StatTile icon={MessageCircle} label="Pending enquiries" value={pendingEnquiries} />
        <StatTile icon={Calendar} label="Upcoming events" value={confirmedBookings} />
        <StatTile icon={Wallet} label="Earned this month" value={analyticsSlice.earnedThisMonthLabel} />
        <StatTile icon={Activity} label="Avg response" value={analyticsSlice.avgResponseLabel} />
      </div>

      <div className="ez-split">
        <div className="ez-split__main ez-stack ez-stack--lg">
          <Card>
            <Card.Header>
              <span className="ez-h3">Needs your attention</span>
              <ButtonLink variant="ghost" size="sm" href="/vendor/bookings">
                All bookings
              </ButtonLink>
            </Card.Header>
            <Card.Body className="ez-stack ez-stack--sm">
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
                    <Badge tone="warning">Pending</Badge>
                    <ButtonLink
                      size="sm"
                      href={`/vendor/bookings/${encodeURIComponent(enquiry.booking_request_id)}`}>
                      Respond
                    </ButtonLink>
                  </div>
                ))
              )}
            </Card.Body>
          </Card>
          <Card>
            <Card.Header>
              <span className="ez-h3">Earnings, last 6 months</span>
            </Card.Header>
            <Card.Body>
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
            </Card.Body>
          </Card>
        </div>
        <div className="ez-split__aside ez-stack ez-stack--lg">
          <Card>
            <Card.Header>
              <span className="ez-h3">{formatDashboardMonthTitle(viewMonth)}</span>
            </Card.Header>
            <Card.Body>
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
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
}
