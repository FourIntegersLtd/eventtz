"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { SIGNUP_GENERIC_ERROR } from "@/lib/auth-messages";
import { getApiErrorDetail } from "@/lib/api-errors";
import { resolvePostAuthPath } from "@/features/auth/authRouting";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import {
  captureReferralFromSearchParams,
  fetchReferralPartnerDisplayName,
} from "@/lib/referralAttribution";
import { parseForm, registerSchema } from "@/lib/validation";

export type RegisterAccountType = "client" | "vendor";

function accountTypeFromQuery(value: string | null): RegisterAccountType {
  return value === "vendor" ? "vendor" : "client";
}

export function useUnifiedRegister() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signUp, isAuthenticated, user } = useAuth();
  const typeParam = searchParams.get("type");
  const [referralSlug, setReferralSlug] = useState<string | null>(null);
  useEffect(() => {
    setReferralSlug(captureReferralFromSearchParams(searchParams));
  }, [searchParams]);
  const referralLocked = Boolean(referralSlug);
  const postAuthQuery = useMemo(() => {
    const next = searchParams.get("next");
    return next ? `next=${encodeURIComponent(next)}` : "";
  }, [searchParams]);
  const [accountType, setAccountType] = useState<RegisterAccountType>(() =>
    referralSlug ? "vendor" : accountTypeFromQuery(typeParam),
  );
  const [referralDisplayName, setReferralDisplayName] = useState<string | null>(null);
  useEffect(() => {
    if (referralSlug) {
      setAccountType("vendor");
      return;
    }
    setAccountType(accountTypeFromQuery(typeParam));
  }, [typeParam, referralSlug]);
  useEffect(() => {
    if (!referralSlug) {
      setReferralDisplayName(null);
      return;
    }
    let cancelled = false;
    void fetchReferralPartnerDisplayName(referralSlug).then((name) => {
      if (!cancelled) setReferralDisplayName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [referralSlug]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setMessage(null);
    const parsed = parseForm(registerSchema, {
      accountType,
      email: email.trim(),
      password,
    });
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.formError);
      return;
    }
    setSubmitting(true);
    try {
      const result = await signUp(parsed.data.email, parsed.data.password, {
        userType: parsed.data.accountType,
        referralCode: parsed.data.accountType === "vendor" ? referralSlug ?? undefined : undefined,
      });
      if (result.message) {
        setMessage(result.message);
      } else {
        router.push(resolvePostAuthPath(searchParams.get("next"), parsed.data.accountType));
      }
    } catch (err: unknown) {
      track(MixpanelEvents.register_failed, { user_type: accountType });
      setError(getApiErrorDetail(err) ?? SIGNUP_GENERIC_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return {
    accountType,
    setAccountType: (value: RegisterAccountType) => {
      if (referralLocked) return;
      setAccountType(value);
      clearFieldError("accountType");
    },
    email,
    setEmail: (value: string) => {
      setEmail(value);
      clearFieldError("email");
    },
    password,
    setPassword: (value: string) => {
      setPassword(value);
      clearFieldError("password");
    },
    error,
    fieldErrors,
    message,
    submitting,
    onSubmit,
    postAuthQuery,
    isAuthenticated,
    userType: user?.user_type,
    referralSlug,
    referralDisplayName,
    referralLocked,
  };
}
