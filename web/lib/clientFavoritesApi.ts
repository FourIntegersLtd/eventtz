import api from "@/lib/axios";

export async function fetchClientFavoriteVendorIds(): Promise<string[]> {
  const { data } = await api.get<{ success: boolean; vendor_user_ids: string[] }>(
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
  const { data } = await api.post<{ success: boolean; merged: number }>(
    "/api/v1/client/favorites/merge",
    { vendor_user_ids: vendorUserIds },
  );
  return data.merged ?? 0;
}
