import api from "@/lib/axios";

export type AdminEmailTemplate = {
  id: string;
  label: string;
  category: string;
  description: string | null;
};

export type AdminEmailTestSendBody = {
  template_id: string;
  to_email: string;
  message_body?: string;
  message_body_html?: string;
};

export type AdminEmailTestSendResult = {
  success: boolean;
  delivered: boolean;
  message: string | null;
};

export const DEFAULT_ADMIN_EMAIL_TEST_BODY =
  "This is a test email from Eventtz. If you received this, Resend delivery is working.";

export const ADMIN_EMAIL_HEALTH_TEMPLATE_ID = "health";

function prefix() {
  return "/api/v1/admin/email";
}

export async function fetchAdminEmailTemplates(): Promise<AdminEmailTemplate[]> {
  const { data } = await api.get<{ templates: AdminEmailTemplate[] }>(`${prefix()}/templates`);
  return data.templates ?? [];
}

export async function sendAdminEmailTest(
  body: AdminEmailTestSendBody,
): Promise<AdminEmailTestSendResult> {
  const { data } = await api.post<AdminEmailTestSendResult>(`${prefix()}/test-send`, body);
  return data;
}
