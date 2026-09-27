/**
 * Which vendor cards a signed-in client has ticked for one shared brief.
 * The map is keyed by vendor user id. Toggling a selected id removes it.
 */

/** A vendor row the selection map can store. */
export type SelectableVendor = {
  user_id: string;
};

/**
 * Add `vendor` when it is absent, or drop it when it is already selected.
 * Other ids are left as they were.
 */
export function toggleSelectedVendor<Vendor extends SelectableVendor>(
  selectedById: Record<string, Vendor>,
  vendor: Vendor,
): Record<string, Vendor> {
  if (selectedById[vendor.user_id]) {
    const next = { ...selectedById };
    delete next[vendor.user_id];
    return next;
  }
  return { ...selectedById, [vendor.user_id]: vendor };
}

/** An empty selection. */
export function clearSelectedVendors<Vendor extends SelectableVendor>(): Record<string, Vendor> {
  return {};
}

/** Selected vendors in insertion order. */
export function listSelectedVendors<Vendor extends SelectableVendor>(
  selectedById: Record<string, Vendor>,
): Vendor[] {
  return Object.values(selectedById);
}

/** A search section that may list its own vendor rows. */
export type VendorSection<Vendor extends SelectableVendor> = {
  vendors?: readonly Vendor[];
};

/**
 * Vendors a planner plan asked to message, taken from the rows this search returned.
 * Ids that are not in `vendors` or any section are skipped. An empty id list selects
 * nothing. A section row wins over the same id in `vendors`, because the baseline
 * walks the flat list first and then each section.
 */
export function plannerPreselection<Vendor extends SelectableVendor>(
  vendorIds: readonly string[],
  vendors: readonly Vendor[],
  sections: readonly VendorSection<Vendor>[],
): Record<string, Vendor> {
  if (vendorIds.length === 0) return {};
  const wanted = new Set(vendorIds);
  const selected: Record<string, Vendor> = {};
  const rows: Vendor[] = [...vendors];
  for (const section of sections) {
    if (section.vendors) rows.push(...section.vendors);
  }
  for (const row of rows) {
    if (wanted.has(row.user_id)) selected[row.user_id] = row;
  }
  return selected;
}
