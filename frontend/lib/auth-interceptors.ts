import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { getMe, refreshSession, type AuthUser } from "@/lib/auth-api";

type RetryableConfig = AxiosRequestConfig & { _retry?: boolean };

type InstallAuthInterceptorsOptions = {
  onUserUpdate: (user: AuthUser | null) => void;
};

let refreshPromise: Promise<void> | null = null;

export function installAuthInterceptors(
  api: AxiosInstance,
  { onUserUpdate }: InstallAuthInterceptorsOptions,
): number {
  return api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const status = error.response?.status;
      const originalConfig = error.config as RetryableConfig | undefined;
      const url = originalConfig?.url ?? "";
      // Allow /auth/me to trigger refresh; skip loops on sign-in/out/up/refresh themselves.
      const isAuthMutation =
        url.includes("/api/v1/auth/signin") ||
        url.includes("/api/v1/auth/signup") ||
        url.includes("/api/v1/auth/signout") ||
        url.includes("/api/v1/auth/refresh");

      if (status !== 401 || isAuthMutation || !originalConfig || originalConfig._retry) {
        return Promise.reject(error);
      }

      originalConfig._retry = true;
      if (!refreshPromise) {
        refreshPromise = refreshSession()
          .then(() => getMe().then((nextUser) => onUserUpdate(nextUser)))
          .finally(() => {
            refreshPromise = null;
          });
      }

      try {
        await refreshPromise;
        return api.request(originalConfig);
      } catch {
        onUserUpdate(null);
        return Promise.reject(error);
      }
    },
  );
}
