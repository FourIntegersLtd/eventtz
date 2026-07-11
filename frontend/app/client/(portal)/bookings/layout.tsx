import type { ReactNode } from "react";
import { PortalFillHeight } from "@/features/portal/PortalFillHeight";

export default function ClientBookingsLayout({ children }: { children: ReactNode }) {
  return <PortalFillHeight>{children}</PortalFillHeight>;
}
