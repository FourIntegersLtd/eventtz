import type { ReactNode } from "react";
import { PortalFillHeight } from "@/features/portal/PortalFillHeight";

export default function ClientMessagesLayout({ children }: { children: ReactNode }) {
  return <PortalFillHeight>{children}</PortalFillHeight>;
}
