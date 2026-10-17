"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { acceptTerms } from "@/lib/auth-api";
import { getApiErrorDetail } from "@/lib/api-errors";

/**
 * Asks a signed-in user to accept the current Terms of Service when the version they
 * accepted is older (or missing). Accepting calls the API, then refreshes the user so
 * the banner disappears. Renders nothing until the API reports the current version.
 */
export function TermsUpdateBanner() {
  const { user, refreshUser } = useAuth();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentVersion = user?.terms_version;
  if (!user || !currentVersion || user.terms_accepted_version === currentVersion) {
    return null;
  }

  const onAccept = async () => {
    setAccepting(true);
    setError(null);
    try {
      await acceptTerms(currentVersion);
      await refreshUser();
    } catch (err: unknown) {
      setError(getApiErrorDetail(err) ?? "Couldn't save that. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-neutral-200/80 bg-white px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:px-5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800">
        <FileText className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-neutral-900">We&apos;ve updated our Terms of Service</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-neutral-600">
          Please read and accept them to keep booking.{" "}
          <Link href="/compliances/terms-of-service" target="_blank" className="font-medium text-neutral-900 underline">
            Read the Terms
          </Link>
        </p>
        {error ? <p className="mt-1 text-[13px] text-red-700">{error}</p> : null}
      </div>
      <Button type="button" size="sm" loading={accepting} onClick={onAccept} className="shrink-0 sm:ml-2">
        Accept
      </Button>
    </div>
  );
}
