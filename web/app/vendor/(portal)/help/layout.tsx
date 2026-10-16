import type { ReactNode } from "react";
import { PortalFillHeight } from "@/components/portal-shell/PortalFillHeight";

export default function VendorHelpLayout({ children }: { children: ReactNode }) {
  return <PortalFillHeight>{children}</PortalFillHeight>;
}
