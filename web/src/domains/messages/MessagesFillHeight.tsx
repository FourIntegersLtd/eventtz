import type { ReactNode } from "react";

/**
 * Locks the messages master-detail to the remaining viewport so each pane
 * scrolls inside itself.
 *
 * The baseline does this with `.portal-fill-height` on the shell. That class
 * lives in the portal shell, which this domain must not edit, so the height
 * is approximated from the shell's mobile bar and main padding.
 */
export function MessagesFillHeight({ children }: { children: ReactNode }) {
  return <div className="flex h-[calc(100dvh-7rem)] min-h-[24rem] flex-col overflow-hidden md:h-[calc(100dvh-4.5rem)]">{children}</div>;
}
