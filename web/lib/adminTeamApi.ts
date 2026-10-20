import api from "@/lib/axios";
import { isSuperAdmin, resolveAdminRole } from "@/lib/adminRole";

import { DEFAULT_LIST_PAGE_SIZE } from "@/lib/listPageSize";
export { isSuperAdmin, resolveAdminRole };

export type AdminTeamMember = {
  user_id: string;
  email: string | null;
  admin_role: "super_admin" | "admin";
  created_at?: string | null;
  account_suspended: boolean;
};

export type AdminTeamInviteResult = {
  success: boolean;
  user_id: string;
  email: string;
  admin_role: "super_admin" | "admin";
  created: boolean;
  invite_link_sent: boolean;
  message: string;
};

export const ADMIN_TEAM_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE;

export async function fetchAdminTeamPage(
  offset = 0,
  limit = ADMIN_TEAM_PAGE_SIZE,
): Promise<{ members: AdminTeamMember[]; total: number; offset: number; limit: number }> {
  const { data } = await api.get<{
    success: boolean;
    members: AdminTeamMember[];
    total: number;
    offset: number;
    limit: number;
  }>("/api/v1/admin/team", { params: { offset, limit } });
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
  const body: { email: string; password?: string } = { email };
  if (password?.trim()) {
    body.password = password.trim();
  }
  const { data } = await api.post<AdminTeamInviteResult>("/api/v1/admin/team/invite", body);
  return data;
}

export async function sendAdminPasswordResetLink(
  userId: string,
): Promise<{ success: boolean; user_id: string; email: string; message: string }> {
  const { data } = await api.post<{ success: boolean; user_id: string; email: string; message: string }>(
    `/api/v1/admin/team/${userId}/send-reset-link`,
    {},
  );
  return data;
}

export async function deleteAdminTeamMember(
  userId: string,
): Promise<{
  success: boolean;
  user_id: string;
  email: string | null;
  deleted: boolean;
  demoted_to: "client" | "vendor" | null;
  message: string;
}> {
  const { data } = await api.delete<{
    success: boolean;
    user_id: string;
    email: string | null;
    deleted: boolean;
    demoted_to: "client" | "vendor" | null;
    message: string;
  }>(`/api/v1/admin/team/${userId}`);
  return data;
}

export async function patchAdminTeamMember(
  userId: string,
  body: { admin_role?: "super_admin" | "admin"; account_suspended?: boolean },
): Promise<AdminTeamMember> {
  const { data } = await api.patch<AdminTeamMember>(`/api/v1/admin/team/${userId}`, body);
  return data;
}
