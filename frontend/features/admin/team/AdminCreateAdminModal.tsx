"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { TextField } from "@/components/ui/TextField";
import { inviteAdminColleague } from "@/lib/adminTeamApi";
import { getApiErrorDetail } from "@/lib/api-errors";

type AdminCreateAdminModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (message: string) => void;
};

export function AdminCreateAdminModal({ isOpen, onClose, onCreated }: AdminCreateAdminModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEmail("");
    setPassword("");
    setError(null);
    setBusy(false);
  }, [isOpen]);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      const result = await inviteAdminColleague(email.trim(), password);
      onCreated(result.message);
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorDetail(err) ?? "Could not create admin account.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create admin account"
      maxWidthClassName="max-w-md"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void handleSubmit()}>
            Create admin
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <TextField
          id="create-admin-email"
          label="Email (username)"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="colleague@company.com"
          required
        />
        <TextField
          id="create-admin-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
          minLength={6}
          required
        />
      </div>
    </Modal>
  );
}
