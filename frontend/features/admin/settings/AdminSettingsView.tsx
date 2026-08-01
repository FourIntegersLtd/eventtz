"use client";

import { KeyRound, Mail, Shield } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { ChangePasswordModal } from "@/features/settings/ChangePasswordModal";
import { resolveAdminRole } from "@/lib/adminRole";

export function AdminSettingsView() {
  const { user } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const role = resolveAdminRole(user);

  return (
    <>
      <div className="max-w-2xl space-y-6">
        <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
          <div className="px-5 py-4 sm:px-6 sm:py-5">
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Account</h2>
            <p className="mt-0.5 text-[13px] text-neutral-400">
              Your admin sign-in details and password.
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
                  {user?.email ?? "-"}
                </dd>
              </div>
            </div>

            <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Shield className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <dt className="text-[13px] text-neutral-500">Role</dt>
                <dd className="text-sm font-medium text-neutral-900">
                  {role === "super_admin" ? "Super admin" : "Admin"}
                </dd>
              </div>
            </div>

            <div className="flex flex-col gap-3 bg-primary/[0.04] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary/70" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-neutral-900">Password</p>
                  <p className="mt-0.5 text-[13px] text-neutral-600">
                    Admin passwords require at least 6 characters with an uppercase letter, a number, and a symbol.
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
          </dl>
        </section>
      </div>

      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        passwordSchema="admin"
        signInPath="/admin/login"
      />
    </>
  );
}
