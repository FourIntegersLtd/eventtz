"use client";

import Link from "next/link";
import { Bell, ChevronRight } from "lucide-react";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";

type Props = {
  role: PortalRole;
};

export function SettingsNotificationsSection({ role }: Props) {
  const href = portalRoute(role, "notifications");

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Notifications</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Booking updates, new messages, and dispute changes appear in the bell menu and on your
        notifications page. Email notification preferences are coming soon.
      </p>

      <Link
        href={href}
        className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-100 bg-neutral-50/50 px-4 py-3 transition hover:border-neutral-200 hover:bg-neutral-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">
          View notification history
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      </Link>
    </section>
  );
}
