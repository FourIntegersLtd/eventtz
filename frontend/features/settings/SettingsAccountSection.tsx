"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Mail, UserCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { TextField } from "@/components/ui/TextField";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";
import { updateClientOnboarding, getClientOnboarding } from "@/lib/clientOnboardingApi";

type Props = {
  role: PortalRole;
};

export function SettingsAccountSection({ role }: Props) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState<string | null>(null);
  const [loadingName, setLoadingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    if (role !== "client") return;
    setLoadingName(true);
    void getClientOnboarding()
      .then((state) => {
        const fromDb = state.preferred_name?.trim() ?? "";
        setName(fromDb);
        setSavedName(fromDb || null);
      })
      .catch(() => {
        const fromUser = user?.preferred_name?.trim() ?? "";
        setName(fromUser);
        setSavedName(fromUser || null);
      })
      .finally(() => setLoadingName(false));
  }, [role, user?.id, user?.preferred_name]);

  const savePreferredName = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError("Please enter a name.");
      return;
    }
    if (trimmed === (savedName ?? "")) return;

    setSaving(true);
    setNameError(null);
    setNameSaved(false);
    try {
      const updated = await updateClientOnboarding({ preferredName: trimmed });
      await refreshUser();
      const next = updated.preferred_name?.trim() ?? trimmed;
      setName(next);
      setSavedName(next || null);
      setNameSaved(true);
    } catch {
      setNameError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card as="section" padding="md">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">Account</h2>
      <p className="mt-1 text-sm text-neutral-500">
        {role === "vendor" ? "Your sign-in email." : "Sign-in email and your name for vendors."}
      </p>

      <dl className="mt-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <dt className="text-xs text-neutral-500">Email</dt>
            <dd className="truncate text-sm font-medium text-neutral-900">{user?.email ?? "—"}</dd>
          </div>
        </div>
      </dl>

      {role === "client" ? (
        <div className="mt-6 border-t border-neutral-100 pt-6">
          {loadingName ? (
            <div className="mt-4">
              <LoadingState label="Loading…" variant="inline" />
            </div>
          ) : (
            <>
              {nameError ? (
                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {nameError}
                </p>
              ) : null}
              {nameSaved ? (
                <p className="mb-3 text-xs font-medium text-primary">Saved.</p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <TextField
                    label="Your name"
                    hint="Shown to vendors."
                    placeholder="e.g. Amina"
                    value={name}
                    maxLength={80}
                    disabled={saving}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (nameError) setNameError(null);
                      if (nameSaved) setNameSaved(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void savePreferredName();
                    }}
                  />
                </div>
                <Button
                  type="button"
                  loading={saving}
                  disabled={!name.trim() || name.trim() === (savedName ?? "")}
                  onClick={() => void savePreferredName()}
                  className="sm:mb-0.5 sm:shrink-0"
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      ) : null}

      {role === "vendor" ? (
        <Link
          href={portalRoute("vendor", "profile")}
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <UserCircle2 className="h-4 w-4" aria-hidden />
          Edit vendor profile
        </Link>
      ) : null}
    </Card>
  );
}
