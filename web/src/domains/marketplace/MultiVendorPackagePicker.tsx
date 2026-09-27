"use client";

/**
 * One package dropdown per selected vendor, plus a quantity stepper for
 * per-unit rates. Prices in the labels are display only.
 */
import {
  defaultQuantityForOption,
  optionLabel,
  pricingOptionsForVendor,
  vendorDisplayName,
  type MultiVendorRow,
} from "./multiVendorEnquire";

type MultiVendorPackagePickerProps = {
  vendors: MultiVendorRow[];
  selectedOptionByVendorId: Record<string, string>;
  onSelectOption: (vendorUserId: string, optionId: string) => void;
  quantityByVendorId: Record<string, number>;
  onQuantityChange: (vendorUserId: string, quantity: number) => void;
};

/** Package choice and, for per-unit rates, a quantity clamped to the minimum. */
export function MultiVendorPackagePicker({
  vendors,
  selectedOptionByVendorId,
  onSelectOption,
  quantityByVendorId,
  onQuantityChange,
}: MultiVendorPackagePickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-neutral-900">Packages</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Choose one package per vendor. For per-item rates, set how many you need.
        </p>
      </div>
      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100 bg-neutral-50/50">
        {vendors.map((vendor) => {
          const options = pricingOptionsForVendor(vendor);
          const selectedId = selectedOptionByVendorId[vendor.user_id] ?? "";
          const selected = options.find((option) => option.id === selectedId);
          const showQuantity = selected?.pricingMode === "per_unit";
          const quantity = showQuantity
            ? (quantityByVendorId[vendor.user_id] ?? defaultQuantityForOption(selected))
            : 1;
          const minimum = selected?.minQuantity ?? 1;
          const maximum = selected?.maxQuantity ?? null;
          return (
            <li key={vendor.user_id} className="space-y-2 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">{vendorDisplayName(vendor)}</p>
              {options.length === 0 ? (
                <p className="text-xs text-amber-800">No bookable packages listed.</p>
              ) : (
                <>
                  <label className="block text-xs font-medium text-neutral-600">
                    Package
                    <select
                      className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900"
                      value={selectedId}
                      onChange={(event) => onSelectOption(vendor.user_id, event.target.value)}
                    >
                      {options.map((option) => (
                        <option key={option.id} value={option.id}>
                          {optionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {showQuantity && selected ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-medium text-neutral-600">Quantity</p>
                      <div
                        className="flex items-center gap-2"
                        role="group"
                        aria-label={`Quantity for ${selected.heading}`}
                      >
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-800 disabled:opacity-40"
                          aria-label="Decrease quantity"
                          disabled={quantity <= minimum}
                          onClick={() =>
                            onQuantityChange(vendor.user_id, Math.max(minimum, quantity - 1))
                          }
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-neutral-900">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-800 disabled:opacity-40"
                          aria-label="Increase quantity"
                          disabled={maximum != null && quantity >= maximum}
                          onClick={() => {
                            const next = quantity + 1;
                            onQuantityChange(
                              vendor.user_id,
                              maximum == null ? next : Math.min(maximum, next),
                            );
                          }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
