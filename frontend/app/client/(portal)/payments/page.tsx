"use client";

import Link from "next/link";
import { ClientPaymentsView } from "@/features/client/payments/ClientPaymentsView";

export default function ClientPaymentsPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link
        href="/client/settings"
        className="inline-flex text-sm font-medium text-primary hover:underline"
      >
        ← Settings
      </Link>
      <header>
        <h1 className="font-heading text-xl font-semibold text-neutral-900">Payment history</h1>
      </header>
      <ClientPaymentsView />
    </div>
  );
}
