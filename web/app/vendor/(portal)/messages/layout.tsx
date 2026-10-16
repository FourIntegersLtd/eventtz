import type { ReactNode } from "react";
import { PortalFillHeight } from "@/components/portal-shell/PortalFillHeight";

export default function VendorMessagesLayout({ children }: { children: ReactNode }) {
  return <PortalFillHeight>{children}</PortalFillHeight>;
}
