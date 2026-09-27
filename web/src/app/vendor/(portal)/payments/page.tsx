import { Card } from "@/foundation/ui";

/**
 * `/vendor/payments` — stub.
 *
 * The Stripe Connect workstream (payouts, bank details, held-funds status)
 * has not landed on `web/` yet, so this route exists only so the portal nav
 * doesn't 404. Replace with the real payments domain once that workstream
 * merges.
 */
export default function VendorPaymentsPage() {
  return (
    <Card padding="lg">
      <h1 className="font-heading text-lg font-semibold text-neutral-900">Payments</h1>
      <p className="mt-2 text-sm text-neutral-600">Payments setup is not available yet. Check back soon.</p>
    </Card>
  );
}
