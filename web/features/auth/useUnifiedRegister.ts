"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { GENERIC_AUTH_ERROR } from "@/lib/auth-messages";
import { getApiErrorDetail } from "@/lib/api-errors";
import { resolvePostAuthPath } from "@/features/auth/authRouting";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { clearFieldError } from "@/lib/formHelpers";
import {
  captureReferralFromSearchParams,
  fetchReferralPartnerDisplayName,
} from "@/lib/referralAttribution";
import policyConstants from "@/lib/policyConstants.json";
import { parseForm, registerSchema } from "@/lib/validation";

export type RegisterAccountType = "client" | "vendor";

function accountTypeFromQuery(value: string | null): RegisterAccountType {
  return value === "client" ? "client" : "vendor";
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
  const [referralDisplayName, setReferralDisplayName] = useState<string | null>(
    null,
  );
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
  const [termsAgreed, setTermsAgreed] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setMessage(null);
    if (!termsAgreed) {
      setFieldErrors({ terms: "Please agree to the Terms of Service and Privacy Policy." });
      return;
    }
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
      const result = await signUp(
        parsed.data.email,
        parsed.data.password,
        parsed.data.accountType,
        parsed.data.accountType === "vendor" ? referralSlug ?? undefined : undefined,
        policyConstants.termsVersion,
      );
      if (result.message) {
        setMessage(result.message);
      } else {
        router.push(
          resolvePostAuthPath(
            searchParams.get("next"),
            parsed.data.accountType,
          ),
        );
      }
    } catch (err: unknown) {
      track(MixpanelEvents.register_failed, { user_type: accountType });
      setError(getApiErrorDetail(err) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  const onFieldErrorClear = (field: string) => {
    setFieldErrors((prev) => clearFieldError(prev, field));
  };

  return {
    accountType,
    setAccountType: (value: RegisterAccountType) => {
      if (referralLocked) return;
      setAccountType(value);
      onFieldErrorClear("accountType");
    },
    email,
    setEmail: (value: string) => {
      setEmail(value);
      onFieldErrorClear("email");
    },
    password,
    setPassword: (value: string) => {
      setPassword(value);
      onFieldErrorClear("password");
    },
    termsAgreed,
    setTermsAgreed: (value: boolean) => {
      setTermsAgreed(value);
      onFieldErrorClear("terms");
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
