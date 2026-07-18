"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { KeyRound, Mail, UserCircle2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { LoadingState } from "@/components/ui/LoadingState";
import { TextField } from "@/components/ui/TextField";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { portalRoute } from "@/components/portal-shell/portalNav";
import { updateClientOnboarding, getClientOnboarding } from "@/lib/clientOnboardingApi";
import { parseForm, preferredNameFormSchema } from "@/lib/validation";
import { ChangePasswordModal } from "./ChangePasswordModal";

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
  const [passwordOpen, setPasswordOpen] = useState(false);

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
    const parsed = parseForm(preferredNameFormSchema, { preferredName: name });
    if (!parsed.ok) {
      setNameError(parsed.formError);
      return;
    }
    if (parsed.data.preferredName === (savedName ?? "")) return;

    setSaving(true);
    setNameError(null);
    setNameSaved(false);
    try {
      const updated = await updateClientOnboarding({ preferredName: parsed.data.preferredName });
      await refreshUser();
      const next = updated.preferred_name?.trim() ?? parsed.data.preferredName;
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
    <>
      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Account</h2>
          <p className="mt-0.5 text-[13px] text-neutral-400">
            {role === "vendor" ? "Your sign-in email." : "Sign-in email and your name for vendors."}
          </p>
        </div>

        <dl className="divide-y divide-neutral-100 border-t border-neutral-100">
          <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Mail className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-[13px] text-neutral-500">Email</dt>
              <dd className="truncate text-sm font-medium text-neutral-900">
                {user?.email ?? "—"}
              </dd>
            </div>
          </div>

          {role === "client" ? (
            <div className="px-5 py-4 sm:px-6">
              {loadingName ? (
                <LoadingState label="Loading…" variant="inline" />
              ) : (
                <>
                  {nameError ? (
                    <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                      {nameError}
                    </p>
                  ) : null}
                  {nameSaved ? (
                    <p className="mb-2 text-xs font-medium text-primary">Saved.</p>
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

          <div className="flex flex-col gap-3 bg-primary/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-start gap-3">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
              <div>
                <p className="text-sm font-medium text-neutral-900">Password</p>
                <p className="mt-0.5 text-[13px] text-neutral-600">
                  Update the password you use to sign in.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="shrink-0"
              onClick={() => setPasswordOpen(true)}
            >
              Change password
            </Button>
          </div>

          {role === "vendor" ? (
            <div className="px-5 py-4 sm:px-6">
              <Link
                href={portalRoute("vendor", "profile")}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <UserCircle2 className="h-4 w-4" aria-hidden />
                Edit vendor profile
              </Link>
            </div>
          ) : null}
        </dl>
      </section>

      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </>
  );
}
