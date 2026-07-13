import api from "@/lib/axios";
import type { ApiEntityResponse } from "@/lib/api-types";
import type { UserType } from "@/lib/domain-types";

export type AuthUser = {
  id: string;
  email: string | null;
  /** From public.users when synced; defaults to client in local mode. */
  user_type?: UserType;
  /** Present for admin accounts: super_admin can manage the team. */
  admin_role?: "super_admin" | "admin" | null;
  account_suspended?: boolean;
  /** Client accounts: what they want to be called (shown to vendors). */
  preferred_name?: string | null;
  /** Client accounts: first-visit portal onboarding done (or skipped). */
  client_onboarding_completed?: boolean;
  user_metadata: Record<string, unknown>;
  app_metadata: Record<string, unknown>;
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

type AuthResponse = {
  success: boolean;
  user: AuthUser;
  session?: AuthSession | null;
  message?: string | null;
};

export async function signIn(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/v1/auth/signin", {
    email,
    password,
  });
  return data;
}

export async function signUp(
  email: string,
  password: string,
  opts?: { userType?: Extract<UserType, "client" | "vendor"> },
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/v1/auth/signup", {
    email,
    password,
    user_type: opts?.userType ?? "client",
  });
  return data;
}

export async function signOut(): Promise<void> {
  await api.post("/api/v1/auth/signout");
}

export async function refreshSession(): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/v1/auth/refresh", {});
  return data;
}

export async function getMe(): Promise<AuthUser> {
  const { data } = await api.get<ApiEntityResponse<AuthUser>>("/api/v1/auth/me");
  return data.user;
}
