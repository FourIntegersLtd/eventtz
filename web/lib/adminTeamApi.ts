import type { components } from "@/lib/api-schema";
import api from "@/lib/axios";
import { isSuperAdmin, resolveAdminRole } from "@/lib/adminRole";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export { isSuperAdmin, resolveAdminRole };

export type AdminTeamMember = components["schemas"]["AdminTeamMember"];

export type AdminTeamInviteResult = components["schemas"]["AdminTeamInviteResponse"];

type AdminTeamDeleteResult = components["schemas"]["AdminTeamDeleteResponse"];

export const ADMIN_TEAM_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function fetchAdminTeamPage(
  offset = 0,
  limit = ADMIN_TEAM_PAGE_SIZE,
): Promise<{ members: AdminTeamMember[]; total: number; offset: number; limit: number }> {
  const { data } = await api.get<components["schemas"]["AdminTeamListResponse"]>(
    "/api/v1/admin/team",
    { params: { offset, limit } },
  );
  return {
    members: data.members ?? [],
    total: data.total ?? 0,
    offset: data.offset ?? offset,
    limit: data.limit ?? limit,
  };
}

/** Every admin for small assignee dropdowns (not the roster table). */
export async function fetchAdminTeam(): Promise<AdminTeamMember[]> {
  const page = await fetchAdminTeamPage(0, 200);
  return page.members;
}

export async function inviteAdminColleague(
  email: string,
  password?: string,
): Promise<AdminTeamInviteResult> {
  const body: components["schemas"]["AdminTeamInviteBody"] = { email };
  if (password?.trim()) {
    body.password = password.trim();
  }
  const { data } = await api.post<AdminTeamInviteResult>("/api/v1/admin/team/invite", body);
  return data;
}

export async function sendAdminPasswordResetLink(
  userId: string,
): Promise<components["schemas"]["AdminTeamSendResetLinkResponse"]> {
  const { data } = await api.post<components["schemas"]["AdminTeamSendResetLinkResponse"]>(
    `/api/v1/admin/team/${userId}/send-reset-link`,
    {},
  );
  return data;
}

export async function deleteAdminTeamMember(userId: string): Promise<AdminTeamDeleteResult> {
  const { data } = await api.delete<AdminTeamDeleteResult>(`/api/v1/admin/team/${userId}`);
  return data;
}

export async function patchAdminTeamMember(
  userId: string,
  body: components["schemas"]["AdminTeamPatchBody"],
): Promise<AdminTeamMember> {
  const { data } = await api.patch<AdminTeamMember>(`/api/v1/admin/team/${userId}`, body);
  return data;
}
