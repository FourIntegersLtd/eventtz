const TRACK_LABELS = ["Request", "Quote", "Payment", "Event", "Payout"] as const;

/** Which step is current in the vendor booking lifecycle strip (0–4). */
export function vendorBookingTrackIndex(
  status: string,
  paymentStatus: string | null | undefined,
): number {
  const bookingStatus = status.toLowerCase();
  const payment = (paymentStatus ?? "").toLowerCase();

  if (bookingStatus === "declined" || bookingStatus === "cancelled") return 0;
  if (bookingStatus === "pending") return 0;
  if (bookingStatus === "accepted" && payment !== "paid" && payment !== "paid_out") return 2;
  if (bookingStatus === "accepted" && (payment === "paid" || payment === "paid_out")) return 3;
  if (bookingStatus === "completed") {
    if (payment === "paid_out") return 4;
    return 3;
  }
  return 1;
}

export function vendorBookingTrackLabels(): readonly string[] {
  return TRACK_LABELS;
}
