import api from "@/lib/axios";
import { isSuperAdmin, resolveAdminRole } from "@/lib/adminRole";

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
  message: string;
};

export async function fetchAdminTeam(): Promise<AdminTeamMember[]> {
  const { data } = await api.get<{ success: boolean; members: AdminTeamMember[] }>("/api/v1/admin/team");
  return data.members ?? [];
}

export async function inviteAdminColleague(
  email: string,
  password: string,
): Promise<AdminTeamInviteResult> {
  const { data } = await api.post<AdminTeamInviteResult>("/api/v1/admin/team/invite", {
    email,
    password,
  });
  return data;
}

export async function patchAdminTeamMember(
  userId: string,
  body: { admin_role?: "super_admin" | "admin"; account_suspended?: boolean },
): Promise<AdminTeamMember> {
  const { data } = await api.patch<AdminTeamMember>(`/api/v1/admin/team/${userId}`, body);
  return data;
}
