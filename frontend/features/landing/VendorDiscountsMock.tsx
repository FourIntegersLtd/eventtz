/** Static onboarding-style panel for the vendor tools landing section. */
export function VendorDiscountsMock() {
  return (
    <div className="flex flex-col bg-white p-5 sm:p-6 lg:p-7">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-primary/70">Step 4 · Pricing</p>
      <h3 className="font-heading mt-3 text-xl font-semibold leading-snug text-neutral-900 sm:text-2xl">
        How do you price your work?
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        Packages, rates, and discounts clients see on your profile.
      </p>

      <div className="mt-6 space-y-2.5">
        <p className="text-sm font-medium text-neutral-800">What packages do you offer?</p>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">Gold package</p>
              <p className="mt-0.5 text-xs text-neutral-500">50 chairs, 5 tables · 2hrs</p>
            </div>
            <p className="text-sm font-semibold text-primary">GBP 450</p>
          </div>
        </div>
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-neutral-900">Silver package</p>
              <p className="mt-0.5 text-xs text-neutral-500">20 chairs, 2 tables · 2hrs</p>
            </div>
            <p className="text-sm font-semibold text-primary">GBP 90</p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-1 flex-col border-t border-neutral-100 pt-6">
        <p className="font-heading text-lg font-semibold text-neutral-900 sm:text-xl">Any discounts?</p>
        <label className="mt-3 flex items-center gap-2 text-sm text-neutral-800">
          <span className="flex h-4 w-4 items-center justify-center rounded border border-primary bg-primary text-[10px] text-white">
            ✓
          </span>
          Offer discounts
        </label>

        <div className="mt-4 flex flex-1 flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Percentage off (e.g. 10%)</p>
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900">
                10
              </div>
              <p className="mt-1 text-xs text-neutral-500">
                Applied to your listed package and rate prices on your public profile.
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Discount name (shown to clients)</p>
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900">
                Summer sale
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">
                Bulk booking (e.g. 10% off over GBP 500)
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900">
                  500
                </div>
                <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900">
                  10
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-sm font-medium text-neutral-700">Off-peak (e.g. winter %)</p>
              <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900">
                5
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 px-3.5 py-3 ring-1 ring-primary/15">
            <p className="text-xs font-medium uppercase tracking-wide text-primary/80">On your profile</p>
            <p className="mt-1 text-sm text-neutral-700">
              <span className="text-neutral-400 line-through">GBP 500</span>{" "}
              <span className="font-semibold text-primary">GBP 450</span>
              <span className="text-emerald-700"> · 10% off — Summer sale</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
