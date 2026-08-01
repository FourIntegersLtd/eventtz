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
      <section className="overflow-hidden rounded-2xl border border-neutral-100 bg-white">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Sign out</h2>
            <p className="mt-0.5 text-[13px] text-neutral-400">End this session on this device.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            icon={<LogOut className="h-4 w-4" aria-hidden />}
            onClick={() => setOpen(true)}
          >
            Sign out
          </Button>
        </div>
      </section>

      <ConfirmDialog
        isOpen={open}
        title="Sign out?"
        description="You'll need to sign in again."
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
