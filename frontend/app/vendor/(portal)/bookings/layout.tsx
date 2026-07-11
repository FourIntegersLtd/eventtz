import type { ReactNode } from "react";
import { PortalFillHeight } from "@/features/portal/PortalFillHeight";

export default function VendorBookingsLayout({ children }: { children: ReactNode }) {
  return <PortalFillHeight>{children}</PortalFillHeight>;
}
