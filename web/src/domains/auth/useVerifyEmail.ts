"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { verifyEmail } from "@/domains/auth/api";
import { authErrorDetail, GENERIC_AUTH_ERROR } from "@/domains/auth/errors";

type VerifyStatus = "verifying" | "success" | "error";

/** Verifies the emailed `?token=` on mount and reports the outcome. */
export function useVerifyEmail() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<VerifyStatus>(token ? "verifying" : "error");
  const [message, setMessage] = useState<string | null>(token ? null : "This verification link is missing its token.");
  const requested = useRef(false);

  useEffect(() => {
    if (!token || requested.current) return;
    requested.current = true;
    verifyEmail(token)
      .then((successMessage) => {
        setStatus("success");
        setMessage(successMessage);
      })
      .catch((cause: unknown) => {
        setStatus("error");
        setMessage(authErrorDetail(cause) ?? GENERIC_AUTH_ERROR);
      });
  }, [token]);

  return { status, message };
}
