import type { ReactNode } from "react";
import { MessagesFillHeight } from "@/domains/messages/MessagesFillHeight";

/** `/vendor/messages` fills the viewport so the inbox and thread scroll inside their panes. */
export default function VendorMessagesLayout({ children }: { children: ReactNode }) {
  return <MessagesFillHeight>{children}</MessagesFillHeight>;
}
