"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { loginPathWithNext } from "@/features/auth/authRouting";
import { ChangePasswordModal } from "@/features/settings/ChangePasswordModal";
import { AdminTestAccountsPanel } from "@/features/admin/settings/AdminTestAccountsPanel";

/** Admin settings: account password and QA test accounts (A22; no platform-fee API on this page). */
export function AdminSettingsView() {
  const { user } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <>
      <div className="max-w-2xl ez-stack ez-stack--lg">
        <section className="ez-card overflow-hidden">
          <div className="ez-card__head">
            <h2 className="ez-h3">Your account</h2>
            <p className="ez-small">Email and password for this admin sign-in.</p>
          </div>
          <div className="ez-card__body ez-stack ez-stack--lg">
            <label className="ez-field">
              <span className="ez-label">Email</span>
              <input className="ez-input" type="email" readOnly value={user?.email ?? ""} />
            </label>
            <div className="ez-field">
              <span className="ez-label">Password</span>
              <p className="ez-small">
                At least 6 characters with an uppercase letter, a number, and a symbol.
              </p>
              <button
                type="button"
                className="ez-btn ez-btn--secondary ez-btn--sm"
                onClick={() => setPasswordOpen(true)}
              >
                Change password
              </button>
            </div>
          </div>
        </section>

        <AdminTestAccountsPanel />
      </div>

      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        passwordSchema="admin"
        signInPath={loginPathWithNext("/admin/dashboard")}
      />
    </>
  );
}
