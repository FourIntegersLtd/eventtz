"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ClientEzPageHead } from "@/components/ui/ClientEzPageHead";

export type ClientMyBookingsSegment = "bookings" | "payments";

type ClientMyBookingsHubProps = {
  segment: ClientMyBookingsSegment;
  children: ReactNode;
};

/** Shared hub header for C10 list and C17 payment history. */
export function ClientMyBookingsHub({ segment, children }: ClientMyBookingsHubProps) {
  return (
    <div className="ez-stack ez-stack--lg">
      <ClientEzPageHead
        title="My bookings"
        actions={
          <div className="ez-seg" aria-label="Bookings or payments">
            <Link
              href="/client/bookings"
              className={segment === "bookings" ? "ez-seg__item ez-seg__item--active" : "ez-seg__item"}
            >
              Bookings
            </Link>
            <Link
              href="/client/payments"
              className={segment === "payments" ? "ez-seg__item ez-seg__item--active" : "ez-seg__item"}
            >
              Payment history
            </Link>
          </div>
        }
      />
      {children}
    </div>
  );
}
