"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SIGNUP_GENERIC_ERROR } from "@/lib/auth-messages";
import { resolvePostAuthPath } from "@/features/auth/authRouting";

export type RegisterAccountType = "client" | "vendor";

function accountTypeFromQuery(value: string | null): RegisterAccountType {
  return value === "vendor" ? "vendor" : "client";
}

export function useUnifiedRegister() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, isAuthenticated, user } = useAuth();
  const typeParam = searchParams.get("type");
  const postAuthQuery = useMemo(() => {
    const next = searchParams.get("next");
    return next ? `next=${encodeURIComponent(next)}` : "";
  }, [searchParams]);
  const [accountType, setAccountType] = useState<RegisterAccountType>(() =>
    accountTypeFromQuery(typeParam),
  );
  // `/register` and `/register?type=vendor` are the same route segment, so nav
  // links between them (e.g. "Become a vendor" <-> "Create account") don't
  // remount this hook — re-sync the dropdown whenever the `type` param itself changes.
  useEffect(() => {
    setAccountType(accountTypeFromQuery(typeParam));
  }, [typeParam]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await signUp(email.trim(), password, { userType: accountType });
      if (result.message) {
        setMessage(result.message);
      } else {
        router.push(resolvePostAuthPath(searchParams.get("next"), accountType));
      }
    } catch {
      setError(SIGNUP_GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  return {
    accountType,
    setAccountType,
    email,
    setEmail,
    password,
    setPassword,
    error,
    message,
    submitting,
    onSubmit,
    postAuthQuery,
    isAuthenticated,
    userType: user?.user_type,
  };
}
