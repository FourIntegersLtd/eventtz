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
    description:
      role === "client" ? "Requests, quotes, and payments" : "Requests, quotes, and confirmed events",
    icon: CalendarDays,
  };
  const disputes = {
    href: portalRoute(role, "disputes"),
    label: "Disputes",
    description: "Cases on your bookings",
    icon: ShieldAlert,
  };

  if (role === "vendor") {
    return [
      {
        href: "/vendor/profile/reviews",
        label: "Client reviews",
        description: "Feedback from completed bookings",
        icon: Star,
      },
      {
        href: portalRoute("vendor", "payments"),
        label: "Payments & Stripe",
        description: "Payout account and payment history",
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
      description: "Feedback you left after completed bookings",
      icon: Star,
    },
    {
      href: "/client/payments",
      label: "Payment history",
      description: "Paid and in-progress bookings",
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
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Shortcuts</h2>
      <p className="mt-1 text-sm text-neutral-500">Jump to related areas of your account.</p>

      <ul className="mt-4 divide-y divide-neutral-100">
        {shortcuts.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-neutral-50/80"
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
