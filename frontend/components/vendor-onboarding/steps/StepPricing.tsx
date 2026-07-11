import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  createVendorPackage,
  type VendorOnboardingData,
  type VendorOnboardingUpdate,
  type VendorPackageItem,
} from "../types";
import { inputClass, labelClass } from "./form-primitives";

export type StepPricingProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
};

function updatePackage(
  packages: VendorPackageItem[],
  id: string,
  patch: Partial<VendorPackageItem>,
): VendorPackageItem[] {
  return packages.map((p) => (p.id === id ? { ...p, ...patch } : p));
}

export function StepPricing({ data, update }: StepPricingProps) {
  const { packages } = data;

  const addPackage = () => {
    update({ packages: [...packages, createVendorPackage()] });
  };

  const removePackage = (id: string) => {
    if (packages.length <= 1) return;
    update({ packages: packages.filter((p) => p.id !== id) });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-neutral-900">
          Pricing structure
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Add packages with pricing and details so clients can compare offers and
          request quotes directly.
        </p>
      </div>
      <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
        <h3 className="text-sm font-semibold text-neutral-800">Fixed rates</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass()}>Hourly (£ / hr)</label>
            <input
              type="text"
              inputMode="decimal"
              className={inputClass()}
              value={data.hourlyRate}
              onChange={(e) => update({ hourlyRate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClass()}>Daily (£ / day)</label>
            <input
              type="text"
              inputMode="decimal"
              className={inputClass()}
              value={data.dailyRate}
              onChange={(e) => update({ dailyRate: e.target.value })}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.useDefaultTravelHourly}
            onChange={(e) =>
              update({ useDefaultTravelHourly: e.target.checked })
            }
          />
          Use default travel rule for hourly work
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.useDefaultTravelDaily}
            onChange={(e) =>
              update({ useDefaultTravelDaily: e.target.checked })
            }
          />
          Use default travel rule for daily work
        </label>
      </section>
      <section className="space-y-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-neutral-800">Packages</h3>
          <button
            type="button"
            onClick={addPackage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary bg-primary/5 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
            Add package
          </button>
        </div>
        <p className="text-xs text-neutral-500">
          Package name and price are required for any package you fill in.
        </p>
        <div className="space-y-3">
          {packages.map((pkg, index) => {
            const hasPartial =
              !!(
                pkg.title.trim() ||
                pkg.price.trim() ||
                pkg.details.trim() ||
                pkg.duration.trim()
              );
            const displayTitle = pkg.title.trim()
              ? pkg.title.trim()
              : hasPartial && !pkg.title.trim()
                ? null
                : `Package ${index + 1}`;
            const pricePart = pkg.price.trim() ? `£${pkg.price.trim()}` : null;
            const durationPart = pkg.duration.trim() ? pkg.duration.trim() : "";

            return (
              <details
                key={pkg.id}
                open
                className="group rounded-lg border border-neutral-100 bg-neutral-50/80"
              >
                <summary
                  className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">
                      {displayTitle === null ? (
                        <span className="text-amber-700">Name required</span>
                      ) : (
                        displayTitle
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-neutral-600">
                      {pricePart ??
                        (hasPartial && !pkg.price.trim() ? (
                          <span className="text-amber-700">Price required</span>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        ))}
                      {durationPart ? (
                        <span className="text-neutral-500">
                          {" "}
                          · {durationPart}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <ChevronDown
                      className="h-4 w-4 text-neutral-400 transition-transform duration-200 group-open:rotate-180"
                      aria-hidden
                    />
                    {packages.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removePackage(pkg.id);
                        }}
                        className="rounded-md p-1.5 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${typeof displayTitle === "string" ? displayTitle : "package"}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </summary>

                <div className="border-t px-4 py-4">
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass()}>Package name</label>
                      <input
                        className={inputClass()}
                        value={pkg.title}
                        onChange={(e) =>
                          update({
                            packages: updatePackage(packages, pkg.id, {
                              title: e.target.value,
                            }),
                          })
                        }
                        placeholder="e.g. Gold wedding package"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelClass()}>Price (£)</label>
                        <input
                          className={inputClass()}
                          value={pkg.price}
                          onChange={(e) =>
                            update({
                              packages: updatePackage(packages, pkg.id, {
                                price: e.target.value,
                              }),
                            })
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass()}>Duration</label>
                        <input
                          className={inputClass()}
                          value={pkg.duration}
                          onChange={(e) =>
                            update({
                              packages: updatePackage(packages, pkg.id, {
                                duration: e.target.value,
                              }),
                            })
                          }
                          placeholder="e.g. 2 hr coverage"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass()}>Details</label>
                      <textarea
                        className={`${inputClass()} min-h-[72px]`}
                        value={pkg.details}
                        onChange={(e) =>
                          update({
                            packages: updatePackage(packages, pkg.id, {
                              details: e.target.value,
                            }),
                          })
                        }
                        placeholder="What’s included"
                      />
                    </div>
                    <label className="flex items-start gap-2 text-sm text-neutral-800">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={pkg.useDefaultTravelPackage ?? true}
                        onChange={(e) =>
                          update({
                            packages: updatePackage(packages, pkg.id, {
                              useDefaultTravelPackage: e.target.checked,
                            }),
                          })
                        }
                      />
                      <span>
                        Use default travel / delivery rule for this package
                        <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                          Matches what you set in Location &amp; travel (Step 3).
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </section>
      <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
        <h3 className="text-sm font-semibold text-neutral-800">Booking options</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.allowQuoteRequests}
            onChange={(e) => update({ allowQuoteRequests: e.target.checked })}
          />
          Allow clients to request a quote
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={data.offerDiscounts}
            onChange={(e) => update({ offerDiscounts: e.target.checked })}
          />
          Offer discounts
        </label>
        {data.offerDiscounts && (
          <div className="space-y-3 border-t border-neutral-100 pt-3">
            <div>
              <label className={labelClass()}>Percentage off (e.g. 10%)</label>
              <input
                className={inputClass()}
                value={data.discountPercentage}
                onChange={(e) =>
                  update({ discountPercentage: e.target.value })
                }
              />
            </div>
            <div>
              <label className={labelClass()}>
                Bulk booking (e.g. 10% off over £500)
              </label>
              <div className="flex gap-2">
                <input
                  className={inputClass()}
                  placeholder="Threshold £"
                  value={data.bulkDiscountThreshold}
                  onChange={(e) =>
                    update({ bulkDiscountThreshold: e.target.value })
                  }
                />
                <input
                  className={inputClass()}
                  placeholder="% off"
                  value={data.bulkDiscountPercent}
                  onChange={(e) =>
                    update({ bulkDiscountPercent: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className={labelClass()}>Off-peak (e.g. winter %)</label>
              <input
                className={inputClass()}
                value={data.offPeakDiscountPercent}
                onChange={(e) =>
                  update({ offPeakDiscountPercent: e.target.value })
                }
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
