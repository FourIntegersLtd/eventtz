import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type AdminEmailTemplate = components["schemas"]["AdminEmailTemplateRow"];

export type AdminEmailTestSendBody = components["schemas"]["AdminEmailTestSendBody"];

export type AdminEmailTestSendResult = components["schemas"]["AdminEmailTestSendResponse"];

export const DEFAULT_ADMIN_EMAIL_TEST_BODY =
  "This is a test email from Eventtz. If you received this, Resend delivery is working.";

export const ADMIN_EMAIL_HEALTH_TEMPLATE_ID = "health";

function prefix() {
  return "/api/v1/admin/email";
}

export async function fetchAdminEmailTemplates(): Promise<AdminEmailTemplate[]> {
  const { data } = await api.get<components["schemas"]["AdminEmailTemplatesListResponse"]>(
    `${prefix()}/templates`,
  );
  return data.templates ?? [];
}

export async function sendAdminEmailTest(
  body: AdminEmailTestSendBody,
): Promise<AdminEmailTestSendResult> {
  const { data } = await api.post<AdminEmailTestSendResult>(`${prefix()}/test-send`, body);
  return data;
}
