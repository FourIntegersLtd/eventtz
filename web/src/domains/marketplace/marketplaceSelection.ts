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
