import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type ContactSharingSettings = components["schemas"]["ContactSharingSettings"];

export async function fetchContactSharingSettings(): Promise<ContactSharingSettings> {
  const { data } = await api.get<components["schemas"]["ContactSharingSettingsResponse"]>(
    "/api/v1/user/contact-settings",
  );
  return data.settings;
}

export async function updateContactSharingSettings(
  patch: Partial<ContactSharingSettings>,
): Promise<ContactSharingSettings> {
  const { data } = await api.put<components["schemas"]["ContactSharingSettingsResponse"]>(
    "/api/v1/user/contact-settings",
    patch,
  );
  return data.settings;
}

export async function deleteOwnAccount(password: string): Promise<string> {
  const body: components["schemas"]["AccountDeletionRequest"] = { password };
  const { data } = await api.post<components["schemas"]["AccountDeletionResponse"]>(
    "/api/v1/user/account/deletion",
    body,
  );
  return data.message;
}
