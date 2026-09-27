import type { ReactNode } from "react";
import { MessagesFillHeight } from "@/domains/messages/MessagesFillHeight";

/** `/vendor/help` fills the viewport so its tabs' panes scroll inside themselves. */
export default function VendorHelpLayout({ children }: { children: ReactNode }) {
  return <MessagesFillHeight>{children}</MessagesFillHeight>;
}
