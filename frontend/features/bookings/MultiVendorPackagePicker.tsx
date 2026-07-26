import {
  initialOptionSelections,
  optionLabel,
  pricingOptionsForVendor,
  vendorDisplayName,
} from "@/features/bookings/multiVendorPackageSelection";
import type { ExploreVendorSearchRow } from "@/lib/clientExploreApi";

type MultiVendorPackagePickerProps = {
  vendors: ExploreVendorSearchRow[];
  selectedOptionByVendorId: Record<string, string>;
  onSelectOption: (vendorUserId: string, optionId: string) => void;
  /** e.g. planner need label ("DJ", "Catering") keyed by vendor user id */
  vendorCategoryLabels?: Record<string, string>;
};

export function MultiVendorPackagePicker({
  vendors,
  selectedOptionByVendorId,
  onSelectOption,
  vendorCategoryLabels,
}: MultiVendorPackagePickerProps) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-neutral-900">Packages</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Choose one package per vendor. You can change these before sending.
        </p>
      </div>
      <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-100 bg-neutral-50/50">
        {vendors.map((vendor) => {
          const options = pricingOptionsForVendor(vendor);
          const selectedId = selectedOptionByVendorId[vendor.user_id] ?? "";
          const category = vendorCategoryLabels?.[vendor.user_id];
          return (
            <li key={vendor.user_id} className="space-y-2 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">
                  {vendorDisplayName(vendor)}
                </p>
                {category ? (
                  <p className="text-xs text-neutral-500">{category}</p>
                ) : null}
              </div>
              {options.length === 0 ? (
                <p className="text-xs text-amber-800">No bookable packages listed.</p>
              ) : (
                <label className="block text-xs font-medium text-neutral-600">
                  Package
                  <select
                    className="mt-1 w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900"
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
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { initialOptionSelections };
