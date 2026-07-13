"use client";

import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
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
      <section className={`${portalCard} ${portalCardPadding}`}>
        <h2 className="font-heading text-lg font-semibold text-neutral-900">Sign out</h2>
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
