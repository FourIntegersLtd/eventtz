"use client";

import { ClientMyBookingsHub } from "@/features/client/bookings/ClientMyBookingsHub";
import { ClientPaymentsView } from "@/features/client/payments/ClientPaymentsView";

export default function ClientPaymentsPage() {
  return (
    <ClientMyBookingsHub segment="payments">
      <ClientPaymentsView />
    </ClientMyBookingsHub>
  );
}
