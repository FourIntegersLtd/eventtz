/** Shown in UI before payment; must match backend `BOOKING_SERVICE_FEE_PERCENT` / default 5 */

export function getBookingServiceFeePercent(): number {
  const raw = process.env.NEXT_PUBLIC_BOOKING_SERVICE_FEE_PERCENT;
  if (raw == null || raw === "") return 5;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 5;
}
