export function adminTrustReviewsHref(options?: {
  vendorUserId?: string | null;
  vendorName?: string | null;
}): string {
  const params = new URLSearchParams({ tab: "reviews" });
  const vendorId = options?.vendorUserId?.trim();
  if (vendorId) params.set("vendor", vendorId);
  const vendorName = options?.vendorName?.trim();
  if (vendorName) params.set("vendorName", vendorName);
  return `/admin/trust?${params.toString()}`;
}
