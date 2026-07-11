"use client";

import type { ClientBookingListItem } from "@/lib/clientBookingsApi";
import { BookingsCalendarCard, type CalendarAgendaItem } from "@/features/dashboard/BookingsCalendarCard";
import type { ClientBookingsByDate } from "./useClientDashboard";

type Props = {
  bookingsByDate: ClientBookingsByDate;
  agendaRows: ClientBookingListItem[];
  onSelectDate: (dateKey: string) => void;
};

export function ClientBookingsCalendarCard({ bookingsByDate, agendaRows, onSelectDate }: Props) {
  const agenda: CalendarAgendaItem[] = agendaRows.map((b) => ({
    id: b.id,
    title: b.event_name,
    subtitle: b.vendor_display_name,
    date_key: b.event_date.slice(0, 10),
    href: `/client/bookings/${encodeURIComponent(b.id)}`,
  }));

  return (
    <BookingsCalendarCard<ClientBookingListItem>
      title="Calendar"
      viewAllHref="/client/bookings"
      bookingsByDate={bookingsByDate}
      agendaRows={agenda}
      onSelectDate={onSelectDate}
    />
  );
}

