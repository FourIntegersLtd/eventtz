"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";
import { confirmPasswordReset } from "@/domains/auth/api";
import { dashboardPathForUserType } from "@/domains/auth/authRouting";
import { authErrorDetail, GENERIC_AUTH_ERROR } from "@/domains/auth/errors";
import { useSession } from "@/foundation/session";

/** Form state and submit handling for the "reset password" page, reached via the emailed link's `?token=`. */
export function useResetPassword() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useSession();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!token) {
      setError("This reset link is missing its token. Request a new one.");
      return;
    }
    setSubmitting(true);
    try {
      const resetUser = await confirmPasswordReset(token, password);
      await refresh();
      router.push(dashboardPathForUserType(resetUser.user_type as "client" | "vendor" | "admin"));
    } catch (cause: unknown) {
      setError(authErrorDetail(cause) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  return { token, password, setPassword, error, submitting, onSubmit };
}
