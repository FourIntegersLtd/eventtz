import api from "@/lib/axios";

export type ContactSharingSettings = {
  contact_phone: string | null;
  share_email: boolean;
  share_phone: boolean;
  share_address: boolean;
};

export async function fetchContactSharingSettings(): Promise<ContactSharingSettings> {
  const { data } = await api.get<{ settings: ContactSharingSettings }>(
    "/api/v1/user/contact-settings",
  );
  return data.settings;
}

export async function updateContactSharingSettings(
  patch: Partial<ContactSharingSettings>,
): Promise<ContactSharingSettings> {
  const { data } = await api.put<{ settings: ContactSharingSettings }>(
    "/api/v1/user/contact-settings",
    patch,
  );
  return data.settings;
}
