"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionBlock } from "@/components/ui/SectionBlock";

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
      <SectionBlock
        title="Sign out"
        description="End this session on this device."
        trailing={
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            icon={<LogOut className="h-4 w-4" aria-hidden />}
            onClick={() => setOpen(true)}
          >
            Sign out
          </Button>
        }
      />

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
