import type { ReactNode } from "react";
import { MessagesFillHeight } from "@/domains/messages/MessagesFillHeight";

/** `/client/messages` fills the viewport so the inbox and thread scroll inside their panes. */
export default function ClientMessagesLayout({ children }: { children: ReactNode }) {
  return <MessagesFillHeight>{children}</MessagesFillHeight>;
}
