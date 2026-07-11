"use client";

import { RequireRole } from "@/components/auth/RequireRole";

type RequireVendorProps = {
  children: React.ReactNode;
  /** Where to send signed-in non-vendors (clients/admins). Defaults to their own dashboard. */
  redirectTo?: string;
};

export function RequireVendor({ children, redirectTo }: RequireVendorProps) {
  return (
    <RequireRole roles={["vendor"]} redirectTo={redirectTo}>
      {children}
    </RequireRole>
  );
}
