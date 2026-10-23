"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { slugifyPreview } from "@/features/admin/referrals/referralSlugPreview";
import { createReferralPartner, type ReferralPartner } from "@/lib/adminReferralsApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { referralRegisterUrl } from "@/lib/siteUrl";

type AdminCreateReferralPartnerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (partner: ReferralPartner) => void;
};

export function AdminCreateReferralPartnerModal({
  isOpen,
  onClose,
  onCreated,
}: AdminCreateReferralPartnerModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [slugOverride, setSlugOverride] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName("");
    setInstagramHandle("");
    setSlugOverride("");
    setNotes("");
    setBusy(false);
    setError(null);
  }, [isOpen]);

  const slugPreview = slugOverride.trim() || slugifyPreview(displayName);

  const handleSubmit = async () => {
    setError(null);
    const name = displayName.trim();
    if (!name) {
      setError("Display name is required.");
      return;
    }
    setBusy(true);
    try {
      const partner = await createReferralPartner({
        display_name: name,
        instagram_handle: instagramHandle.trim() || undefined,
        slug: slugOverride.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onCreated(partner);
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorDetail(err) ?? "Could not create creator link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create creator link"
      maxWidthClassName="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button loading={busy} onClick={() => void handleSubmit()}>
            Create link
          </Button>
        </>
      }
    >
      <div className="ez-stack">
        <TextField
          label="Creator / display name"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Scenery Studios"
        />
        <TextField
          label="Instagram handle"
          value={instagramHandle}
          onChange={(e) => setInstagramHandle(e.target.value)}
          placeholder="@scenerystudios"
        />
        <TextField
          label="Link slug (optional)"
          value={slugOverride}
          onChange={(e) => setSlugOverride(e.target.value)}
          hint={`Preview: ${referralRegisterUrl(slugPreview)}`}
        />
        <TextArea
          label="Internal notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
        />
        {error ? (
          <Banner tone="danger">
            <p className="text-sm">{error}</p>
          </Banner>
        ) : null}
      </div>
    </Modal>
  );
}
