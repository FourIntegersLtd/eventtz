"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { register } from "@/domains/auth/api";
import { resolvePostAuthPath } from "@/domains/auth/authRouting";
import { authErrorDetail, GENERIC_AUTH_ERROR } from "@/domains/auth/errors";
import { useSession } from "@/foundation/session";

export type RegisterAccountType = "client" | "vendor";

function accountTypeFromQuery(value: string | null): RegisterAccountType {
  return value === "vendor" ? "vendor" : "client";
}

/**
 * Form state and submit handling for the registration page. Ported
 * (referral capture left out — that belongs to the vendor-referrals feature,
 * not this workstream) from the baseline's `useUnifiedRegister`.
 */
export function useRegister() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const [accountType, setAccountType] = useState<RegisterAccountType>(() =>
    accountTypeFromQuery(searchParams.get("type")),
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      const result = await register({ email: email.trim(), password, userType: accountType });
      if (result.message) {
        setMessage(result.message);
      } else {
        await refresh();
        router.push(resolvePostAuthPath(searchParams.get("next"), accountType));
      }
    } catch (cause: unknown) {
      setError(authErrorDetail(cause) ?? GENERIC_AUTH_ERROR);
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
  };
}
