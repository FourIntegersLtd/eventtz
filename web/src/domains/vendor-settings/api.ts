import { platformRequest, type components } from "@/foundation/platform-client";

/** Contact-sharing preferences: what a booking counterparty can see. */
export type ContactSharingSettings = components["schemas"]["ContactSharingSettings"];
export type ContactSharingSettingsPutBody = components["schemas"]["ContactSharingSettingsPutBody"];

/** Fetch the signed-in user's saved contact-sharing settings. */
export async function fetchContactSettings(): Promise<ContactSharingSettings> {
  const response = await platformRequest<components["schemas"]["ContactSharingSettingsResponse"]>(
    "/api/v1/user/contact-settings",
  );
  return response.settings;
}

/** Save a partial change to contact-sharing settings; omitted fields are left alone. */
export async function saveContactSettings(body: ContactSharingSettingsPutBody): Promise<ContactSharingSettings> {
  const response = await platformRequest<components["schemas"]["ContactSharingSettingsResponse"]>(
    "/api/v1/user/contact-settings",
    { method: "PUT", body },
  );
  return response.settings;
}
