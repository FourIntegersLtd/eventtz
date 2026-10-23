"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { useToast } from "@/components/ui/Toast";
import { resetMixpanel } from "@/lib/mixpanelClient";
import {
  deleteOwnAccount,
  fetchContactSharingSettings,
  type ContactSharingSettings,
} from "@/lib/userSettingsApi";
import { deleteAccountSchema, parseForm } from "@/lib/validation";
import { deleteAccountErrorMessage, persistContactSharingToggle } from "./settingsHelpers";

/** One settings card: a titled body with an optional action row, shared by client and vendor settings. */
export function SettingsCard({
  title,
  children,
  footer,
  bodyClassName = "",
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Card>
      <Card.Header>
        <span className="ez-h3">{title}</span>
      </Card.Header>
      <Card.Body className={bodyClassName}>{children}</Card.Body>
      {footer ? <Card.Footer>{footer}</Card.Footer> : null}
    </Card>
  );
}

/** A label, a hint and an on/off checkbox on one row. */
export function SettingToggleRow({
  title,
  detail,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="ez-list-row">
      <div className="ez-list-row__main">
        <span className="ez-strong">{title}</span>
        <span className="ez-small">{detail}</span>
      </div>
      <Checkbox checked={checked} disabled={disabled} onChange={onChange}>
        {checked ? "On" : "Off"}
      </Checkbox>
    </div>
  );
}

/** Contact-sharing settings and the switch handler; `contact` stays null until loaded or when loading fails. */
export function useContactSharing(savedTitle: string, failedTitle: string) {
  const { showToast } = useToast();
  const [contact, setContact] = useState<ContactSharingSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchContactSharingSettings()
      .then((settings) => {
        if (!cancelled) setContact(settings);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = async (key: "share_email" | "share_phone") => {
    if (!contact) return;
    setSaving(true);
    try {
      setContact(await persistContactSharingToggle(contact, key));
      showToast({ title: savedTitle, tone: "success" });
    } catch {
      showToast({ title: failedTitle, tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return { contact, saving, toggle };
}

export type ContactSharingCopy = {
  cardTitle: string;
  emailTitle: string;
  phoneTitle: string;
  phoneDetail: string;
};

/** The "share my email / phone" card; the wording differs per role, the behaviour does not. */
export function ContactSharingCard({
  copy,
  contact,
  saving,
  onToggle,
}: {
  copy: ContactSharingCopy;
  contact: ContactSharingSettings;
  saving: boolean;
  onToggle: (key: "share_email" | "share_phone") => void;
}) {
  const { user } = useAuth();
  return (
    <SettingsCard title={copy.cardTitle}>
      <SettingToggleRow
        title={copy.emailTitle}
        detail={user?.email ?? "Your sign-in email"}
        checked={contact.share_email}
        disabled={saving}
        onChange={() => onToggle("share_email")}
      />
      <SettingToggleRow
        title={copy.phoneTitle}
        detail={copy.phoneDetail}
        checked={contact.share_phone}
        disabled={saving}
        onChange={() => onToggle("share_phone")}
      />
    </SettingsCard>
  );
}

/** Password change entry: the card with a button that opens the shared change-password modal. */
export function SecurityCard({ showSignInLine = false }: { showSignInLine?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsCard title="Security">
        {showSignInLine ? (
          <div className="ez-lines mb-3">
            <div className="ez-lines__row">
              <span>Sign-in</span>
              <span>Email and password</span>
            </div>
          </div>
        ) : null}
        <Button variant="secondary" icon={<Lock size={18} strokeWidth={1.75} aria-hidden />} onClick={() => setOpen(true)}>
          Change password
        </Button>
      </SettingsCard>
      <ChangePasswordModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export type CloseAccountCopy = {
  cardDescription: string;
  modalTitle: string;
  modalBody: string;
  cancelLabel: string;
  confirmLabel: string;
  /** `client` keeps the compact modal with buttons under the field; `vendor` the footer layout. */
  layout: "client" | "vendor";
};

/** Close-account card and its password-confirmation modal; on success the session ends and the user leaves. */
export function CloseAccountCard({ copy }: { copy: CloseAccountCopy }) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const dismiss = () => {
    if (closing) return;
    setOpen(false);
    setPassword("");
    setError(null);
  };

  const closeAccount = async () => {
    setError(null);
    const parsed = parseForm(deleteAccountSchema, { password });
    if (!parsed.ok) {
      setError(parsed.formError ?? parsed.fieldErrors.password ?? "Enter your password.");
      return;
    }
    setClosing(true);
    try {
      await deleteOwnAccount(parsed.data.password);
      resetMixpanel();
      try {
        await signOut();
      } catch {
        /* cookies already cleared */
      }
      router.replace("/");
    } catch (err: unknown) {
      setError(deleteAccountErrorMessage(err));
    } finally {
      setClosing(false);
    }
  };

  return (
    <>
      <SettingsCard
        title="Close account"
        footer={
          <Button variant="destructive" onClick={() => setOpen(true)}>
            Close my account
          </Button>
        }
      >
        <p className="ez-small">{copy.cardDescription}</p>
      </SettingsCard>
      {copy.layout === "vendor" ? (
        <Modal
          isOpen={open}
          onClose={dismiss}
          title={copy.modalTitle}
          maxWidthClassName="max-w-md"
          footer={
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" disabled={closing} onClick={dismiss}>
                {copy.cancelLabel}
              </Button>
              <Button variant="destructive" disabled={closing || !password.trim()} onClick={() => void closeAccount()}>
                {closing ? "Closing…" : copy.confirmLabel}
              </Button>
            </div>
          }
        >
          <p className="ez-small">{copy.modalBody}</p>
          {error ? <LottieFailureInline message={error} className="mt-3" /> : null}
          <div className="mt-4">
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </Modal>
      ) : (
        <Modal isOpen={open} title={copy.modalTitle} onClose={dismiss}>
          <p className="ez-small">{copy.modalBody}</p>
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error ? <LottieFailureInline message={error} /> : null}
          <div className="ez-hrow mt-4">
            <Button variant="secondary" disabled={closing} onClick={dismiss}>
              {copy.cancelLabel}
            </Button>
            <Button variant="destructive" disabled={closing} onClick={() => void closeAccount()}>
              {closing ? "Closing…" : copy.confirmLabel}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Privacy, terms and cookies links shared by both settings pages. */
export function PolicyLinksCard() {
  return (
    <Card>
      <Card.Body>
        <p className="ez-small">
          <a href="/compliances/privacy-policy">Privacy policy</a>
          {" · "}
          <a href="/compliances/terms-of-service">Terms of service</a>
          {" · "}
          <a href="/compliances/cookies-policy">Cookies policy</a>
        </p>
      </Card.Body>
    </Card>
  );
}
