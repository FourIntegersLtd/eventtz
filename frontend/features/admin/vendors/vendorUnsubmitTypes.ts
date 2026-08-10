import type { AdminVendorUnsubmitResult } from "@/lib/adminVendorsApi";

export type AdminVendorUnsubmitHandler = (
  userId: string,
  options?: { message?: string },
) => Promise<AdminVendorUnsubmitResult | null>;
