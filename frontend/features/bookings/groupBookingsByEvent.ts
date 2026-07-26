import type { ClientBookingListItem } from "@/lib/clientBookingsApi";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import { formatEventDate } from "@/lib/dateFormat";

export type BookingEventGroup = {
  key: string;
  eventId: string | null;
  title: string;
  dateLabel: string;
  bookingCount: number;
  rows: BookingListRowViewModel[];
};

export function groupBookingsByEvent(
  rows: BookingListRowViewModel[],
  itemsById: Map<string, ClientBookingListItem>,
): BookingEventGroup[] {
  const buckets = new Map<string, BookingEventGroup>();

  for (const row of rows) {
    const item = itemsById.get(row.id);
    const eventId = item?.event_id?.trim() || null;
    const title =
      item?.event_title?.trim() ||
      item?.event_name?.trim() ||
      row.eventName ||
      "Booking";
    const dateKey = item?.event_date?.slice(0, 10) || "";
    const key = eventId ?? `legacy:${title.toLowerCase()}:${dateKey}`;

    let group = buckets.get(key);
    if (!group) {
      group = {
        key,
        eventId,
        title,
        dateLabel: dateKey ? formatEventDate(dateKey) : "",
        bookingCount: 0,
        rows: [],
      };
      buckets.set(key, group);
    }
    group.rows.push(row);
    group.bookingCount += 1;
  }

  return [...buckets.values()].sort((a, b) => {
    const ad = itemsById.get(a.rows[0]?.id ?? "")?.event_date ?? "";
    const bd = itemsById.get(b.rows[0]?.id ?? "")?.event_date ?? "";
    return ad.localeCompare(bd);
  });
}
