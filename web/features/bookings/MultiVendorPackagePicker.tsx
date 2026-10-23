import {
  initialOptionSelections,
  optionLabel,
  pricingOptionsForVendor,
  vendorDisplayName,
  defaultQuantityForOption,
} from "@/features/bookings/multiVendorPackageSelection";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";
import { formControlClass } from "@/components/ui/tokens";
import { QuantityStepper } from "@/components/ui/QuantityStepper";

type MultiVendorPackagePickerProps = {
  vendors: ExploreVendorSearchRow[];
  selectedOptionByVendorId: Record<string, string>;
  onSelectOption: (vendorUserId: string, optionId: string) => void;
  quantityByVendorId?: Record<string, number>;
  onQuantityChange?: (vendorUserId: string, quantity: number) => void;
  /** e.g. planner need label ("DJ", "Catering") keyed by vendor user id */
  vendorCategoryLabels?: Record<string, string>;
};

export function MultiVendorPackagePicker({
  vendors,
  selectedOptionByVendorId,
  onSelectOption,
  quantityByVendorId = {},
  onQuantityChange,
  vendorCategoryLabels,
}: MultiVendorPackagePickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-ink">Packages</p>
        <p className="mt-0.5 text-xs text-ink-3">
          Choose one package per vendor. For per-item rates, set how many you need.
        </p>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-surface-3">
        {vendors.map((vendor) => {
          const options = pricingOptionsForVendor(vendor);
          const selectedId = selectedOptionByVendorId[vendor.user_id] ?? "";
          const category = vendorCategoryLabels?.[vendor.user_id];
          return (
            <li key={vendor.user_id} className="space-y-2 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {vendorDisplayName(vendor)}
                </p>
                {category ? (
                  <p className="text-xs text-ink-3">{category}</p>
                ) : null}
              </div>
              {options.length === 0 ? (
                <p className="text-xs text-amber-800">No bookable packages listed.</p>
              ) : (
                <>
                  <label className="block text-xs font-medium text-ink-2">
                    Package
                    <select
                      className={formControlClass("mt-1 rounded-xl")}
                      value={selectedId}
                      onChange={(e) => onSelectOption(vendor.user_id, e.target.value)}
                    >
                      {options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {optionLabel(opt)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const selected = options.find((o) => o.id === selectedId);
                    if (!selected || selected.pricingMode !== "per_unit" || !onQuantityChange) {
                      return null;
                    }
                    const qty =
                      quantityByVendorId[vendor.user_id] ?? defaultQuantityForOption(selected);
                    return (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-medium text-ink-2">Quantity</p>
                        <QuantityStepper
                          value={qty}
                          min={selected.minQuantity}
                          max={selected.maxQuantity}
                          onChange={(next) => onQuantityChange(vendor.user_id, next)}
                          allowZero={false}
                          aria-label={`Quantity for ${selected.heading}`}
                        />
                      </div>
                    );
                  })()}
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { initialOptionSelections };
