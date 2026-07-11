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
};

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

  useRealtimeSse(Boolean(user?.id));

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      signIn: async (email, password) => {
        await apiSignIn(email, password);
        await refreshUser();
      },
      signUp: async (email, password, opts) => {
        const result = await apiSignUp(email, password, opts);
        await refreshUser();
        return { message: result.message };
      },
      signOut: async () => {
        try {
          await apiSignOut();
        } finally {
          setUser(null);
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
