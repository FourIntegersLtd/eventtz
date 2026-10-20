/** Design C10 list tabs (distinct from vendor Active/Closed). */
export type ClientBookingsListTab = "upcoming" | "past" | "cancelled";

export const CLIENT_BOOKINGS_TAB_LABELS: Record<ClientBookingsListTab, string> = {
  upcoming: "Upcoming",
  past: "Past",
  cancelled: "Cancelled",
};
