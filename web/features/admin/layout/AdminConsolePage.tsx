"use client";

import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin-shell/AdminShell";
import { PageHeader } from "@/components/ui/PageHeader";

type AdminConsolePageProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** When false, the in-page `ez-pagehead` is omitted (detail screens supply their own). */
  showPageHead?: boolean;
  children: ReactNode;
};

/** Thin wrapper - use inside `(portal)` layout after auth guards. */
export function AdminConsolePage({
  title,
  description,
  actions,
  showPageHead = true,
  children,
}: AdminConsolePageProps) {
  return (
    <AdminShell>
      <div className="ez-stack ez-stack--lg">
        {showPageHead ? (
          <PageHeader title={title} description={description} actions={actions} />
        ) : null}
        {children}
      </div>
    </AdminShell>
  );
}
