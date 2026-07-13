/** Static vendor panel for the landing page — booking and payout. */
export function VendorDashboardMock() {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="rounded-2xl border border-primary-border/60 bg-primary-soft/30 p-4 sm:p-5">
        <p className="text-xs font-medium text-primary">New booking</p>
        <p className="font-heading mt-1 text-base font-semibold text-neutral-900">Summer wedding</p>
        <p className="mt-1 text-sm text-neutral-600">12 Aug · London</p>
        <p className="mt-2 text-sm text-neutral-700">
          Gold package · <span className="font-semibold text-primary">GBP 450</span>
        </p>
        <span className="mt-4 inline-block rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-white">
          Review booking
        </span>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Paid</p>
        <p className="font-heading mt-1 text-base font-semibold text-primary">Event complete?</p>
        <p className="mt-2 text-sm leading-relaxed text-neutral-600">
          Confirm it went well and get paid when the event is done.
        </p>
        <span className="mt-4 inline-block w-full rounded-xl border border-neutral-200 bg-white py-2.5 text-center text-xs font-semibold text-neutral-800">
          Mark complete
        </span>
      </div>
    </div>
  );
}
