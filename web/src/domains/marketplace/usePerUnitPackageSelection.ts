"use client";

/**
 * Package selection for the vendor profile sidebar.
 * Quantity changes go through `syncPerUnitPackageSelection` so a per-unit
 * package selects itself once the quantity reaches its minimum.
 */
import { useCallback, useMemo, useState } from "react";
import { syncPerUnitPackageSelection, type PackageSelectionState } from "./perUnitPackageSelection";
import {
  buildBookingLineItems,
  type BookingLineItem,
  type BrowsePricingOption,
} from "./vendorBrowseDetailModel";

type UsePerUnitPackageSelectionArgs = {
  pricingOptions: BrowsePricingOption[];
  initialSelectedIds?: string[];
  initialQuantities?: Record<string, number>;
  onSelectionChange?: () => void;
};

/** Selected package ids, quantities, and the estimate lines those imply. */
export function usePerUnitPackageSelection({
  pricingOptions,
  initialSelectedIds = [],
  initialQuantities = {},
  onSelectionChange,
}: UsePerUnitPackageSelectionArgs) {
  const [selection, setSelection] = useState<PackageSelectionState>(() => ({
    selectedIds: new Set(initialSelectedIds),
    quantities: { ...initialQuantities },
  }));

  const notifySelectionChange = useCallback(() => {
    onSelectionChange?.();
  }, [onSelectionChange]);

  const togglePackage = useCallback(
    (id: string) => {
      setSelection((prev) => {
        const nextSelectedIds = new Set(prev.selectedIds);
        if (nextSelectedIds.has(id)) nextSelectedIds.delete(id);
        else nextSelectedIds.add(id);
        return { ...prev, selectedIds: nextSelectedIds };
      });
      notifySelectionChange();
    },
    [notifySelectionChange],
  );

  const setPackageQuantity = useCallback(
    (id: string, quantity: number) => {
      setSelection((prev) =>
        syncPerUnitPackageSelection(pricingOptions, prev.selectedIds, prev.quantities, id, quantity),
      );
      notifySelectionChange();
    },
    [pricingOptions, notifySelectionChange],
  );

  const lineItems: BookingLineItem[] = useMemo(
    () => buildBookingLineItems(pricingOptions, [...selection.selectedIds], selection.quantities),
    [pricingOptions, selection.selectedIds, selection.quantities],
  );

  return {
    selectedIds: selection.selectedIds,
    quantities: selection.quantities,
    togglePackage,
    setPackageQuantity,
    lineItems,
    selectedIdList: [...selection.selectedIds],
  };
}
