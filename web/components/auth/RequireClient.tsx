"use client";

import { RequireRole } from "@/components/auth/RequireRole";

type RequireClientProps = {
  children: React.ReactNode;
  /** Where to send signed-in non-clients (vendors/admins). Defaults to their own dashboard. */
  redirectTo?: string;
};

export function RequireClient({ children, redirectTo }: RequireClientProps) {
  return (
    <RequireRole roles={["client"]} redirectTo={redirectTo}>
      {children}
    </RequireRole>
  );
}
