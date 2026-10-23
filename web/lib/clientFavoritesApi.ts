import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export async function fetchClientFavoriteVendorIds(): Promise<string[]> {
  const { data } = await api.get<components["schemas"]["ClientFavoritesListResponse"]>(
    "/api/v1/client/favorites",
  );
  return data.vendor_user_ids ?? [];
}

export async function addClientFavorite(vendorUserId: string): Promise<void> {
  await api.put(`/api/v1/client/favorites/${encodeURIComponent(vendorUserId)}`);
}

export async function removeClientFavorite(vendorUserId: string): Promise<void> {
  await api.delete(`/api/v1/client/favorites/${encodeURIComponent(vendorUserId)}`);
}

export async function mergeClientFavorites(vendorUserIds: string[]): Promise<number> {
  const body: components["schemas"]["ClientFavoritesMergeBody"] = {
    vendor_user_ids: vendorUserIds,
  };
  const { data } = await api.post<components["schemas"]["ClientFavoritesMergeResponse"]>(
    "/api/v1/client/favorites/merge",
    body,
  );
  return data.merged ?? 0;
}
