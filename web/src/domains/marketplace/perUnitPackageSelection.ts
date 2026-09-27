/**
 * Pure selection rules for per-unit packages on the vendor profile.
 * Reaching the package minimum selects it; dropping below deselects it.
 * Fixed packages are left as the caller set them.
 */
import type { BrowsePricingOption } from "./vendorBrowseDetailModel";

export type PackageSelectionState = {
  selectedIds: Set<string>;
  quantities: Record<string, number>;
};

/** Apply one quantity change and sync whether that per-unit package stays selected. */
export function syncPerUnitPackageSelection(
  pricingOptions: BrowsePricingOption[],
  selectedIds: Set<string>,
  quantities: Record<string, number>,
  id: string,
  quantity: number,
): PackageSelectionState {
  const option = pricingOptions.find((entry) => entry.id === id);
  const nextQuantities = { ...quantities, [id]: quantity };
  const nextSelectedIds = new Set(selectedIds);
  if (option?.pricingMode === "per_unit") {
    if (quantity >= option.minQuantity) nextSelectedIds.add(id);
    else nextSelectedIds.delete(id);
  }
  return { selectedIds: nextSelectedIds, quantities: nextQuantities };
}
