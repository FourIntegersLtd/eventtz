import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

/**
 * Changes the signed-in admin's password. The API re-checks the current one
 * and ends every session (this one included), so the caller should sign the
 * admin out and send them back to `/login` afterwards.
 */
export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
): Promise<components["schemas"]["ChangePasswordResponse"]> {
  return platformRequest<components["schemas"]["ChangePasswordResponse"]>("/api/v1/auth/change-password", {
    method: "POST",
    body: { current_password: currentPassword, new_password: newPassword },
  });
}
