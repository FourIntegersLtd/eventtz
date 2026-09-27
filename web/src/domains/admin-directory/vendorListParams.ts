/** Query params for `fetchAdminVendors` — omits empty filters. */

export type VendorListParamsInput = {
  offset: number;
  limit: number;
  search: string;
  approvalStatus: string;
};

export function buildVendorListParams(input: VendorListParamsInput): {
  offset: number;
  limit: number;
  q?: string;
  approval_status?: string;
} {
  const search = input.search.trim();
  const approvalStatus = input.approvalStatus.trim();
  return {
    offset: input.offset,
    limit: input.limit,
    ...(search ? { q: search } : {}),
    ...(approvalStatus ? { approval_status: approvalStatus } : {}),
  };
}
