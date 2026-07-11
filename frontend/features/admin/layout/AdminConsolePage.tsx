"use client";

import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell/AdminShell";

type AdminConsolePageProps = {
  title: string;
  children: ReactNode;
};

/** Thin wrapper — use inside `(console)` layout after auth guards. */
export function AdminConsolePage({ title, children }: AdminConsolePageProps) {
  return <AdminShell title={title}>{children}</AdminShell>;
}
