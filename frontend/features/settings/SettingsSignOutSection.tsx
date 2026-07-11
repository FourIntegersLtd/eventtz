"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function SettingsSignOutSection() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <>
      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-neutral-200/50 sm:p-6">
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Sign out</h2>
        <p className="mt-1 text-sm text-neutral-500">Sign out of Eventtz on this device.</p>
        <Button
          variant="secondary"
          className="mt-4"
          icon={<LogOut className="h-4 w-4" aria-hidden />}
          onClick={() => setOpen(true)}
        >
          Sign out
        </Button>
      </section>

      <ConfirmDialog
        isOpen={open}
        title="Sign out?"
        description="You'll need to sign in again to access your account."
        confirmLabel="Sign out"
        confirmLoadingLabel="Signing out…"
        confirmVariant="destructive"
        loading={loading}
        onCancel={() => setOpen(false)}
        onConfirm={() => void handleSignOut()}
      />
    </>
  );
}
