import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";

export type ContactSubmitBody = components["schemas"]["ContactSubmitBody"];

export async function submitClientContact(body: ContactSubmitBody): Promise<void> {
  await api.post("/api/v1/client/contact", body);
}

export async function submitVendorContact(body: ContactSubmitBody): Promise<void> {
  await api.post("/api/v1/vendor/contact", body);
}

export async function submitAdminContact(message: string): Promise<void> {
  const body: components["schemas"]["AdminBugReportBody"] = { message };
  await api.post("/api/v1/admin/contact", body);
}
