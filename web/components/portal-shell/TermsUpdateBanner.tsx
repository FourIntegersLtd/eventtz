"use client";

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
      className="mb-4 flex flex-col gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200/70 sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        We&apos;ve updated our Terms of Service. Please read and accept them to keep booking.{" "}
        <Link href="/compliances/terms-of-service" target="_blank" className="font-medium underline">
          Read the Terms
        </Link>
        {error ? <span className="mt-1 block text-red-700">{error}</span> : null}
      </p>
      <Button type="button" loading={accepting} onClick={onAccept} className="shrink-0">
        Accept
      </Button>
    </div>
  );
}
