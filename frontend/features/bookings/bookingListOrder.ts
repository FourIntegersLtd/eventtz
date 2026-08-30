/** Mirrors backend `sort_booking_rows_recent_first` for list items. */
export type BookingListActivityFields = {
  updated_at?: string | null;
  created_at?: string | null;
};

export function bookingListActivityTimestamp(
  item: BookingListActivityFields | null | undefined,
): string {
  return item?.updated_at?.trim() || item?.created_at?.trim() || "";
}

export function compareBookingsRecentFirst(
  a: BookingListActivityFields,
  b: BookingListActivityFields,
): number {
  return bookingListActivityTimestamp(b).localeCompare(bookingListActivityTimestamp(a));
}

export function sortBookingListItemsRecentFirst<T extends BookingListActivityFields>(
  items: T[],
): T[] {
  return [...items].sort(compareBookingsRecentFirst);
}
