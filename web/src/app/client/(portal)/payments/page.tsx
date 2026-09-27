import Link from "next/link";
import { ClientPaymentsView } from "@/domains/client-bookings/ClientPaymentsView";

/** `/client/payments` — bookings the client has paid for. */
export default function ClientPaymentsPage() {
  return (
    <div className="w-full max-w-3xl space-y-6">
      <Link href="/client/settings" className="text-sm font-medium text-primary hover:underline">
        ← Settings
      </Link>
      <header>
        <h1 className="font-heading text-xl font-semibold text-neutral-900">Payment history</h1>
      </header>
      <ClientPaymentsView />
    </div>
  );
}
