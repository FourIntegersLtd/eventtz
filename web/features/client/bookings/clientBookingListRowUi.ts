import type { ClientBookingListItem } from "@/lib/clientBookingsApi";

export function clientListRowBadge(item: ClientBookingListItem): { className: string; label: string } {
  const status = item.booking_status.toLowerCase();
  if (status === "pending" && item.initiator === "vendor") {
    return { className: "ez-badge--info", label: "Quote received" };
  }
  if (status === "pending") {
    return { className: "ez-badge--warning", label: "Waiting for vendor" };
  }
  if (status === "accepted" && item.payment_status !== "paid") {
    return { className: "ez-badge--warning", label: "Payment due" };
  }
  if (status === "accepted") {
    return { className: "ez-badge--success", label: "Confirmed" };
  }
  if (status === "completed") {
    return { className: "ez-badge--success", label: "Complete" };
  }
  if (status === "cancelled") {
    return { className: "ez-badge--neutral", label: "Cancelled" };
  }
  if (status === "declined") {
    return { className: "ez-badge--neutral", label: "Declined" };
  }
  return { className: "ez-badge--info", label: item.booking_status };
}

export function clientListRowCta(item: ClientBookingListItem): string | null {
  const status = item.booking_status.toLowerCase();
  if (status === "pending" && item.initiator === "vendor") return "Review quote";
  if (status === "accepted" && item.payment_status !== "paid") return "Pay now";
  if (status === "completed" && !item.has_review) return "Leave review";
  if (item.completion_waiting_on === "client") return "Confirm complete";
  return "View booking";
}

export function clientListRowInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
