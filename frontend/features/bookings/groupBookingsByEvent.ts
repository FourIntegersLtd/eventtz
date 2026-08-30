import type { BookingListRowViewModel } from "@/features/bookings/bookingViewModel";
import {
  bookingListActivityTimestamp,
  compareBookingsRecentFirst,
} from "@/features/bookings/bookingListOrder";
import { formatEventDate } from "@/lib/dateFormat";

/** Minimal list fields used to bucket bookings under one client event. */
export type BookingEventGroupingItem = {
  event_id?: string | null;
  event_title?: string | null;
  event_name?: string;
  event_date?: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type BookingEventGroupCounterparty = "vendor" | "client";

export type BookingEventGroup = {
  key: string;
  eventId: string | null;
  title: string;
  dateLabel: string;
  bookingCount: number;
  counterpartyNoun: BookingEventGroupCounterparty;
  rows: BookingListRowViewModel[];
};

export function groupBookingsByEvent(
  rows: BookingListRowViewModel[],
  itemsById: Map<string, BookingEventGroupingItem>,
  counterpartyNoun: BookingEventGroupCounterparty = "vendor",
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
        counterpartyNoun,
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

/** Group headers only when an event has multiple counterparties (e.g. several vendors). */
export function bookingEventGroupsForList(
  rows: BookingListRowViewModel[],
  itemsById: Map<string, BookingEventGroupingItem>,
  counterpartyNoun: BookingEventGroupCounterparty,
  enabled: boolean,
): BookingEventGroup[] | null {
  if (!enabled || rows.length === 0) return null;
  const groups = groupBookingsByEvent(rows, itemsById, counterpartyNoun);
  return groups.some((group) => group.bookingCount > 1) ? groups : null;
}
