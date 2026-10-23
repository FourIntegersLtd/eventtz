import type { WithFields } from "@/lib/apiTypeHelpers";
import api from "@/lib/axios";
import type { components } from "@/lib/api-schema";
import type { UserType } from "@/lib/domain-types";

/** Narrowed by hand where the API types a field as a plain string or a free-form dict. */
export type AuthUser = WithFields<
  components["schemas"]["AuthUser"],
  {
    user_type?: UserType;
    admin_role?: "super_admin" | "admin" | null;
    user_metadata: Record<string, unknown>;
    app_metadata: Record<string, unknown>;
  }
>;

type AuthSession = components["schemas"]["AuthSession"];

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
  userType: Extract<UserType, "client" | "vendor"> = "client",
  referralCode?: string,
  termsVersion?: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/v1/auth/signup", {
    email,
    password,
    user_type: userType,
    referral_code: referralCode,
    terms_version: termsVersion,
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
  const { data } = await api.get<WithFields<components["schemas"]["MeResponse"], { user: AuthUser }>>(
    "/api/v1/auth/me",
  );
  return data.user;
}

export async function forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>(
    "/api/v1/auth/forgot-password",
    { email },
  );
  return data;
}

export async function resetPassword(
  token: string,
  password: string,
): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/v1/auth/reset-password", {
    token,
    password,
  });
  return data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>(
    "/api/v1/auth/change-password",
    {
      current_password: currentPassword,
      new_password: newPassword,
    },
  );
  return data;
}

export async function resendVerification(
  email: string,
): Promise<{ success: boolean; message: string }> {
  const { data } = await api.post<{ success: boolean; message: string }>(
    "/api/v1/auth/resend-verification",
    { email },
  );
  return data;
}

export async function verifyEmail(
  token: string,
): Promise<{
  success: boolean;
  message: string;
  user?: AuthUser | null;
  session?: AuthSession | null;
}> {
  const { data } = await api.post("/api/v1/auth/verify-email", { token });
  return data;
}

/** Record that the signed-in user accepted the current Terms version. */
export async function acceptTerms(version: string): Promise<void> {
  await api.post("/api/v1/user/terms/accept", { version });
}
