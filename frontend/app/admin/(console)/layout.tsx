"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { RequireAdmin } from "@/components/auth/RequireAdmin";

export default function AdminConsoleLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const redirectTo = `/admin/login?next=${encodeURIComponent(pathname)}`;

  return (
    <RequireAuth redirectTo={redirectTo}>
      <RequireAdmin>{children}</RequireAdmin>
    </RequireAuth>
  );
}
