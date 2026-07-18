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
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Notifications</h2>
        <p className="mt-0.5 text-[13px] text-neutral-400">Booking updates and messages.</p>
      </div>
      <Link
        href={href}
        className="flex items-center gap-3 border-t border-neutral-100 bg-primary/[0.04] px-5 py-4 transition hover:bg-primary/[0.06] sm:px-6"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bell className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 text-sm font-medium text-neutral-900">
          All notifications
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
      </Link>
    </section>
  );
}
