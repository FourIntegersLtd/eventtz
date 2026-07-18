"use client";

import Link from "next/link";
import { ChevronRight, CalendarDays, ShieldAlert, Star, Wallet, type LucideIcon } from "lucide-react";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";

type Shortcut = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

function shortcutsForRole(role: PortalRole): Shortcut[] {
  const bookings = {
    href: portalRoute(role, "bookings"),
    label: role === "client" ? "My bookings" : "Bookings",
    description: role === "client" ? "Bookings and payments" : "All bookings",
    icon: CalendarDays,
  };
  const disputes = {
    href: portalRoute(role, "disputes"),
    label: "Disputes",
    description: "Open cases",
    icon: ShieldAlert,
  };

  if (role === "vendor") {
    return [
      {
        href: "/vendor/profile/reviews",
        label: "Client reviews",
        description: "From clients",
        icon: Star,
      },
      {
        href: portalRoute("vendor", "payments"),
        label: "Payments",
        description: "Payouts",
        icon: Wallet,
      },
      disputes,
      bookings,
    ];
  }

  return [
    {
      href: "/client/settings/reviews",
      label: "Your reviews",
      description: "Reviews you wrote",
      icon: Star,
    },
    {
      href: "/client/payments",
      label: "Payment history",
      description: "What you've paid",
      icon: Wallet,
    },
    bookings,
    disputes,
  ];
}

type Props = {
  role: PortalRole;
};

export function SettingsShortcutsSection({ role }: Props) {
  const shortcuts = shortcutsForRole(role);

  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
      <div className="px-5 py-4 sm:px-6 sm:py-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Shortcuts</h2>
        <p className="mt-0.5 text-[13px] text-neutral-400">Jump to common pages</p>
      </div>
      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80 sm:px-6"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-neutral-900">{item.label}</span>
                  <span className="block text-xs text-neutral-500">{item.description}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
