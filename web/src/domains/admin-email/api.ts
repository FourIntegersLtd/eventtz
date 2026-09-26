import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminEmailTemplate = components["schemas"]["AdminEmailTemplateRow"];

/** The fixed list of layouts a test email can be sent with. */
export async function fetchAdminEmailTemplates(): Promise<AdminEmailTemplate[]> {
  const response = await platformRequest<components["schemas"]["AdminEmailTemplatesListResponse"]>(
    "/api/v1/admin/email/templates",
  );
  return response.templates;
}

/** Sends a real test email through Resend, super-admin only. */
export async function sendAdminEmailTest(
  body: components["schemas"]["AdminEmailTestSendBody"],
): Promise<components["schemas"]["AdminEmailTestSendResponse"]> {
  return platformRequest<components["schemas"]["AdminEmailTestSendResponse"]>("/api/v1/admin/email/test-send", {
    method: "POST",
    body,
  });
}
