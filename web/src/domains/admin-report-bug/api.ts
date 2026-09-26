import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

/** Sends a staff bug report from the admin console. */
export async function submitAdminBugReport(message: string): Promise<void> {
  await platformRequest("/api/v1/admin/contact", {
    method: "POST",
    body: { message } satisfies components["schemas"]["AdminBugReportBody"],
  });
}
