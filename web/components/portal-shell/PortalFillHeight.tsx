import type { ReactNode } from "react";

/** Locks portal page content to the shell viewport so master-detail panes scroll internally. */
export function PortalFillHeight({ children }: { children: ReactNode }) {
  return <div className="portal-fill-height">{children}</div>;
}
