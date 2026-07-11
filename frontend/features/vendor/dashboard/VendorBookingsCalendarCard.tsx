"use client";

import type { VendorBookingListItem } from "@/lib/vendorBookingsApi";
import { BookingsCalendarCard, type CalendarAgendaItem } from "@/features/dashboard/BookingsCalendarCard";
import type { VendorBookingsByDate } from "./useVendorDashboard";

type Props = {
  bookingsByDate: VendorBookingsByDate;
  agendaRows: VendorBookingListItem[];
  onSelectDate: (dateKey: string) => void;
};

export function VendorBookingsCalendarCard({ bookingsByDate, agendaRows, onSelectDate }: Props) {
  const agenda: CalendarAgendaItem[] = agendaRows.map((b) => ({
    id: b.id,
    title: b.event_name,
    subtitle: b.client_email ?? undefined,
    date_key: b.event_date.slice(0, 10),
    href: `/vendor/bookings/${encodeURIComponent(b.id)}`,
  }));

  return (
    <BookingsCalendarCard<VendorBookingListItem>
      title="Calendar"
      viewAllHref="/vendor/bookings"
      bookingsByDate={bookingsByDate}
      agendaRows={agenda}
      onSelectDate={onSelectDate}
    />
  );
}

