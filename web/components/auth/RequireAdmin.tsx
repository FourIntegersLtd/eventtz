"use client";

import { RequireRole } from "@/components/auth/RequireRole";

type RequireAdminProps = {
  children: React.ReactNode;
  /** Where to send signed-in non-admins. Defaults to their own dashboard (client/vendor). */
  redirectTo?: string;
};

export function RequireAdmin({ children, redirectTo }: RequireAdminProps) {
  return (
    <RequireRole roles={["admin"]} redirectTo={redirectTo}>
      {children}
    </RequireRole>
  );
}
