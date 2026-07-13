"use client";

import { BackLink } from "@/components/ui/BackLink";
import { ClientPaymentsView } from "@/features/client/payments/ClientPaymentsView";

export default function ClientPaymentsPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <BackLink href="/client/settings" label="Settings" icon="chevron" />
      <header>
        <h1 className="font-heading text-xl font-semibold text-neutral-900">Payment history</h1>
      </header>
      <ClientPaymentsView />
    </div>
  );
}
