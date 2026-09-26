"use client";

import { type FormEvent, useState } from "react";
import { requestPasswordReset } from "@/domains/auth/api";
import { authErrorDetail, GENERIC_AUTH_ERROR } from "@/domains/auth/errors";

/**
 * Form state and submit handling for the "forgot password" page. The API
 * responds with a generic message whether or not the address is registered,
 * so this never reveals account existence.
 */
export function useForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      setMessage("If that email has an account, we've sent a link to reset your password.");
    } catch (cause: unknown) {
      setError(authErrorDetail(cause) ?? GENERIC_AUTH_ERROR);
    } finally {
      setSubmitting(false);
    }
  };

  return { email, setEmail, error, message, submitting, onSubmit };
}
