import type { ReactNode } from "react";
import { MessagesFillHeight } from "@/domains/messages/MessagesFillHeight";

/** `/client/help` fills the viewport so its tabs' panes scroll inside themselves. */
export default function ClientHelpLayout({ children }: { children: ReactNode }) {
  return <MessagesFillHeight>{children}</MessagesFillHeight>;
}
