"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useAuth } from "@/components/auth/AuthProvider";
import { loginPathWithNext } from "@/features/auth/authRouting";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { AdminTestAccountsPanel } from "@/features/admin/settings/AdminTestAccountsPanel";

/** Admin settings: account password and QA test accounts (A22; no platform-fee API on this page). */
export function AdminSettingsView() {
  const { user } = useAuth();
  const [passwordOpen, setPasswordOpen] = useState(false);

  return (
    <>
      <div className="max-w-2xl ez-stack ez-stack--lg">
        <Card as="section" className="overflow-hidden">
          <Card.Header>
            <h2 className="ez-h3">Your account</h2>
            <p className="ez-small">Email and password for this admin sign-in.</p>
          </Card.Header>
          <Card.Body className="ez-stack ez-stack--lg">
            <label className="ez-field">
              <span className="ez-label">Email</span>
              <input className="ez-input" type="email" readOnly value={user?.email ?? ""} />
            </label>
            <div className="ez-field">
              <span className="ez-label">Password</span>
              <p className="ez-small">
                At least 6 characters with an uppercase letter, a number, and a symbol.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setPasswordOpen(true)}>
                Change password
              </Button>
            </div>
          </Card.Body>
        </Card>

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
