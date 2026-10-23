import api from "@/lib/axios";
import type { ClientBookingListItem } from "@/lib/clientBookingsApi";
import type { VendorBookingListItem } from "@/lib/vendorBookingsApi";
import type { NotificationFeedItem } from "@/lib/notificationsFeedApi";

export type ClientDashboardPayload = {
  success: boolean;
  active_count: number;
  completed_count: number;
  awaiting_vendor_count: number;
  awaiting_client_count: number;
  next_booking: ClientBookingListItem | null;
  active_bookings: ClientBookingListItem[];
  upcoming_agenda: ClientBookingListItem[];
  bookings_by_date: Record<string, ClientBookingListItem[]>;
  needs_review: ClientBookingListItem[];
  notification_preview: { items: NotificationFeedItem[] };
};

export type VendorDashboardPayload = {
  success: boolean;
  active_bookings_count: number;
  pending_bookings_count: number;
  /** Bookings behind the payments screen's held money (the payout ledger's awaiting rows). */
  held_payouts_count: number;
  active_bookings: VendorBookingListItem[];
  needs_response: VendorBookingListItem[];
  upcoming_agenda: VendorBookingListItem[];
  bookings_by_date: Record<string, VendorBookingListItem[]>;
  notification_preview: { items: NotificationFeedItem[] };
};

export async function fetchClientDashboard(): Promise<ClientDashboardPayload> {
  const { data } = await api.get<ClientDashboardPayload>("/api/v1/client/dashboard");
  return data;
}

export async function fetchVendorDashboard(): Promise<VendorDashboardPayload> {
  const { data } = await api.get<VendorDashboardPayload>("/api/v1/vendor/dashboard");
  return data;
}
