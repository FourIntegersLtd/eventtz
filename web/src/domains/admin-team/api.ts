import { platformRequest } from "@/foundation/platform-client";
import type { components } from "@/foundation/platform-client/schema";

export type AdminTeamMember = components["schemas"]["AdminTeamMember"];

/** The admin colleague roster. */
export async function fetchAdminTeam(): Promise<AdminTeamMember[]> {
  const response = await platformRequest<components["schemas"]["AdminTeamListResponse"]>("/api/v1/admin/team");
  return response.members;
}

/** Creates (or sends a setup link to) a new admin colleague. An omitted password sends a setup link. */
export async function inviteAdminColleague(
  email: string,
  password?: string,
): Promise<components["schemas"]["AdminTeamInviteResponse"]> {
  return platformRequest<components["schemas"]["AdminTeamInviteResponse"]>("/api/v1/admin/team/invite", {
    method: "POST",
    body: { email, password: password || null },
  });
}

/** Sends a colleague a password reset link. */
export async function sendAdminPasswordResetLink(
  userId: string,
): Promise<components["schemas"]["AdminTeamSendResetLinkResponse"]> {
  return platformRequest<components["schemas"]["AdminTeamSendResetLinkResponse"]>(
    `/api/v1/admin/team/${encodeURIComponent(userId)}/send-reset-link`,
    { method: "POST" },
  );
}

/** Removes a colleague from the admin team, demoting them back to a client/vendor account. */
export async function deleteAdminTeamMember(userId: string): Promise<components["schemas"]["AdminTeamDeleteResponse"]> {
  return platformRequest<components["schemas"]["AdminTeamDeleteResponse"]>(
    `/api/v1/admin/team/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

/** Changes a colleague's role and/or suspension state. */
export async function patchAdminTeamMember(
  userId: string,
  body: { admin_role?: "super_admin" | "admin"; account_suspended?: boolean },
): Promise<AdminTeamMember> {
  return platformRequest<AdminTeamMember>(`/api/v1/admin/team/${encodeURIComponent(userId)}`, {
    method: "PATCH",
    body,
  });
}
