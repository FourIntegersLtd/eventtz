"use client";

import { useCallback, useMemo, useState } from "react";
import {
  buildBookingLineItems,
  type BrowsePricingOption,
  type BookingLineItem,
} from "../../../lib/vendorBrowseDetailModel";

type UsePerUnitPackageSelectionArgs = {
  pricingOptions: BrowsePricingOption[];
  initialSelectedIds?: string[];
  initialQuantities?: Record<string, number>;
  onSelectionChange?: () => void;
};

type PackageSelectionState = {
  selectedIds: Set<string>;
  quantities: Record<string, number>;
};

export function syncPerUnitPackageSelection(
  pricingOptions: BrowsePricingOption[],
  selectedIds: Set<string>,
  quantities: Record<string, number>,
  id: string,
  qty: number,
): PackageSelectionState {
  const option = pricingOptions.find((entry) => entry.id === id);
  const nextQuantities = { ...quantities, [id]: qty };
  const nextSelectedIds = new Set(selectedIds);
  if (option?.pricingMode === "per_unit") {
    if (qty >= option.minQuantity) nextSelectedIds.add(id);
    else nextSelectedIds.delete(id);
  }
  return { selectedIds: nextSelectedIds, quantities: nextQuantities };
}

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
    (id: string, qty: number) => {
      setSelection((prev) =>
        syncPerUnitPackageSelection(
          pricingOptions,
          prev.selectedIds,
          prev.quantities,
          id,
          qty,
        ),
      );
      notifySelectionChange();
    },
    [pricingOptions, notifySelectionChange],
  );

  const lineItems: BookingLineItem[] = useMemo(
    () =>
      buildBookingLineItems(
        pricingOptions,
        [...selection.selectedIds],
        selection.quantities,
      ),
    [pricingOptions, selection.selectedIds, selection.quantities],
  );

  return {
    selectedIds: selection.selectedIds,
    setSelectedIds: (next: Set<string>) =>
      setSelection((prev) => ({ ...prev, selectedIds: next })),
    quantities: selection.quantities,
    setQuantities: (next: Record<string, number>) =>
      setSelection((prev) => ({ ...prev, quantities: next })),
    togglePackage,
    setPackageQuantity,
    lineItems,
    selectedIdList: [...selection.selectedIds],
  };
}
