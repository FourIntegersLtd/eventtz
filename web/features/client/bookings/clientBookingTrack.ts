const CLIENT_TRACK_LABELS = ["Request", "Quote", "Paid", "Event", "Complete"] as const;

/** Client booking lifecycle strip on list rows and detail (design C10–C11). */
export function clientBookingTrackIndex(
  status: string,
  paymentStatus: string | null | undefined,
  initiator?: string | null,
): number {
  const bookingStatus = status.toLowerCase();
  const payment = (paymentStatus ?? "").toLowerCase();

  if (bookingStatus === "declined" || bookingStatus === "cancelled") return 0;
  if (bookingStatus === "pending") {
    if (initiator === "vendor") return 1;
    return 0;
  }
  if (bookingStatus === "accepted" && payment !== "paid" && payment !== "payout_released") return 2;
  if (bookingStatus === "accepted") return 3;
  if (bookingStatus === "completed") return 4;
  return 0;
}

export function clientBookingTrackLabels(): readonly string[] {
  return CLIENT_TRACK_LABELS;
}
