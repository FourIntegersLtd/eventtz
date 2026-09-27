/**
 * One-time merge of guest favorites from localStorage into a signed-in client account.
 */

/** True when local guest ids should be POSTed to the merge endpoint for this client. */
export function shouldMergeGuestFavorites(
  localVendorIds: string[],
  mergedMarkerClientId: string | null,
  signedInClientId: string,
): boolean {
  return localVendorIds.length > 0 && mergedMarkerClientId !== signedInClientId;
}
