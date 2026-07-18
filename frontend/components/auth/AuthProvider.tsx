"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import { installAuthInterceptors } from "@/lib/auth-interceptors";
import {
  getMe,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  type AuthUser,
} from "@/lib/auth-api";
import type { UserType } from "@/lib/domain-types";
import {
  identifyMixpanelUser,
  initMixpanel,
  resetMixpanel,
} from "@/lib/mixpanelClient";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { useRealtimeSse } from "@/lib/useRealtimeSse";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    opts?: { userType?: Extract<UserType, "client" | "vendor"> },
  ) => Promise<{ message?: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const interceptorId = installAuthInterceptors(api, {
      onUserUpdate: setUser,
    });

    return () => {
      api.interceptors.response.eject(interceptorId);
    };
  }, []);

  useEffect(() => {
    initMixpanel();
  }, []);

  const refreshUser = async () => {
    try {
      const nextUser = await getMe();
      setUser(nextUser);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    identifyMixpanelUser(user.id, {
      email: user.email,
      user_type: user.user_type ?? null,
      admin_role: user.admin_role ?? null,
    });
  }, [user]);

  useRealtimeSse(user?.id);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      signIn: async (email, password) => {
        await apiSignIn(email, password);
        await refreshUser();
        track(MixpanelEvents.user_signed_in);
      },
      signUp: async (email, password, opts) => {
        const result = await apiSignUp(email, password, opts);
        await refreshUser();
        track(MixpanelEvents.user_signed_up, {
          user_type: opts?.userType ?? "client",
        });
        return { message: result.message };
      },
      signOut: async () => {
        try {
          track(MixpanelEvents.user_signed_out);
          await apiSignOut();
        } finally {
          setUser(null);
          resetMixpanel();
        }
      },
      refreshUser,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
