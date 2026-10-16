import type { ReactNode } from "react";
import { PortalFillHeight } from "@/components/portal-shell/PortalFillHeight";

export default function ClientMessagesLayout({ children }: { children: ReactNode }) {
  return <PortalFillHeight>{children}</PortalFillHeight>;
}
