import type { ClientBookingListItem } from "@/lib/clientBookingsApi";
import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import {
  bookingListActivityTimestamp,
  compareBookingsRecentFirst,
} from "@/features/bookings/bookingListOrder";
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

  return [...buckets.values()]
    .map((group) => ({
      ...group,
      rows: [...group.rows].sort((a, b) =>
        compareBookingsRecentFirst(
          itemsById.get(a.id) ?? {},
          itemsById.get(b.id) ?? {},
        ),
      ),
    }))
    .sort((a, b) => {
      const aTs = a.rows.reduce(
        (max, row) => {
          const ts = bookingListActivityTimestamp(itemsById.get(row.id));
          return ts > max ? ts : max;
        },
        "",
      );
      const bTs = b.rows.reduce(
        (max, row) => {
          const ts = bookingListActivityTimestamp(itemsById.get(row.id));
          return ts > max ? ts : max;
        },
        "",
      );
      return bTs.localeCompare(aTs);
    });
}
