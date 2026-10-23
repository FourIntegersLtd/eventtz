"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bell, CalendarDays, ChevronRight, Lock, Route, ShieldAlert } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { ClientEzPageHead } from "@/components/ui/ClientEzPageHead";
import { EzCheck, EzTextField } from "@/components/ui/ez-form";
import { useClientOnboarding } from "@/features/client/onboarding/ClientOnboardingProvider";
import { ChangePasswordModal } from "@/components/auth/ChangePasswordModal";
import { deleteAccountErrorMessage } from "@/features/settings/SettingsDeleteAccountSection";
import { persistContactSharingToggle } from "@/features/settings/ContactSharingSettingsSection";
import { getClientOnboarding, updateClientOnboarding } from "@/lib/clientOnboardingApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { deleteOwnAccount, fetchContactSharingSettings, type ContactSharingSettings } from "@/lib/userSettingsApi";
import { deleteAccountSchema, parseForm, preferredNameFormSchema } from "@/lib/validation";
import { resetMixpanel } from "@/lib/mixpanelClient";
import { portalRoute } from "@/components/portal-shell/portalNav";

type SettingsTab = "account" | "privacy" | "more";

function resolveTab(value: string | null): SettingsTab {
  if (value === "privacy" || value === "more") return value;
  return "account";
}

/**
 * Client settings (design C26): same ez card layout as vendor `VendorSettingsEzView`.
 */
export function ClientSettingsEzView() {
  const { user, refreshUser, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));
  const { openReplay } = useClientOnboarding();

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [contact, setContact] = useState<ContactSharingSettings | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closePassword, setClosePassword] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getClientOnboarding()
      .then((state) => {
        if (!cancelled) {
          setName(state.preferred_name?.trim() ?? user?.preferred_name?.trim() ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) setName(user?.preferred_name?.trim() ?? "");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void fetchContactSharingSettings()
      .then((settings) => {
        if (!cancelled) setContact(settings);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.preferred_name]);

  const saveAccount = async () => {
    const parsed = parseForm(preferredNameFormSchema, { preferredName: name });
    if (!parsed.ok) {
      showToast({ title: parsed.formError ?? "Enter a valid name", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      await updateClientOnboarding({ preferredName: parsed.data.preferredName });
      await refreshUser();
      showToast({ title: "Account saved", tone: "success" });
    } catch (err: unknown) {
      showToast({
        title: "Could not save",
        description: getApiErrorDetail(err) ?? "Try again.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleContact = async (key: "share_email" | "share_phone") => {
    if (!contact) return;
    setContactSaving(true);
    try {
      const updated = await persistContactSharingToggle(contact, key);
      setContact(updated);
      showToast({ title: "Privacy preferences saved", tone: "success" });
    } catch {
      showToast({ title: "Could not save preferences", tone: "error" });
    } finally {
      setContactSaving(false);
    }
  };

  const closeAccount = async () => {
    setCloseError(null);
    const parsed = parseForm(deleteAccountSchema, { password: closePassword });
    if (!parsed.ok) {
      setCloseError(parsed.formError ?? parsed.fieldErrors.password ?? "Enter your password.");
      return;
    }
    setClosing(true);
    try {
      await deleteOwnAccount(parsed.data.password);
      resetMixpanel();
      try {
        await signOut();
      } catch {
        /* cookies cleared */
      }
      router.replace("/");
    } catch (err: unknown) {
      setCloseError(deleteAccountErrorMessage(err));
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return <LoadingState label="Loading settings…" variant="centered" />;
  }

  const settingsBase = portalRoute("client", "settings");

  return (
    <div className="ez-stack ez-stack--lg min-w-0 max-w-3xl">
      <ClientEzPageHead
        eyebrow="Account"
        title="Settings"
        description="Your sign-in, privacy, and shortcuts."
      />

      <div className="ez-tabs" role="tablist">
        <Link className={`ez-tab${tab === "account" ? " ez-tab--active" : ""}`} href={settingsBase}>
          Account
        </Link>
        <Link className={`ez-tab${tab === "privacy" ? " ez-tab--active" : ""}`} href={`${settingsBase}?tab=privacy`}>
          Privacy
        </Link>
        <Link className={`ez-tab${tab === "more" ? " ez-tab--active" : ""}`} href={`${settingsBase}?tab=more`}>
          More
        </Link>
      </div>

      {tab === "account" ? (
        <div className="ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Account</span>
            </div>
            <div className="ez-card__body">
              <div className="ez-form-grid">
                <EzTextField
                  label="Your name"
                  value={name}
                  autoComplete="name"
                  onChange={setName}
                />
                <EzTextField
                  label="Email"
                  type="email"
                  value={user?.email ?? ""}
                  readOnly
                  onChange={() => undefined}
                />
              </div>
            </div>
            <div className="ez-card__foot">
              <button
                type="button"
                className="ez-btn ez-btn--primary"
                disabled={saving}
                onClick={() => void saveAccount()}
              >
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Tour</span>
            </div>
            <div className="ez-card__body">
              <p className="ez-small">Replay the welcome tour for clients.</p>
            </div>
            <div className="ez-card__foot">
              <button type="button" className="ez-btn ez-btn--secondary" onClick={openReplay}>
                <Route size={18} strokeWidth={1.75} aria-hidden />
                Show tour again
              </button>
            </div>
          </div>

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Security</span>
            </div>
            <div className="ez-card__body">
              <button type="button" className="ez-btn ez-btn--secondary" onClick={() => setPasswordOpen(true)}>
                <Lock size={18} strokeWidth={1.75} aria-hidden />
                Change password
              </button>
            </div>
          </div>

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Close account</span>
            </div>
            <div className="ez-card__body">
              <p className="ez-small">
                Closing is permanent. Finish or cancel open bookings before you close your account.
              </p>
            </div>
            <div className="ez-card__foot">
              <button type="button" className="ez-btn ez-btn--danger-quiet" onClick={() => setCloseOpen(true)}>
                Close my account
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "privacy" ? (
        <div className="ez-stack ez-stack--lg">
          {contact ? (
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">Contact sharing</span>
              </div>
              <div className="ez-card__body">
                <div className="ez-list-row">
                  <div className="ez-list-row__main">
                    <span className="ez-strong">Share my email with vendors</span>
                    <span className="ez-small">{user?.email ?? "Your sign-in email"}</span>
                  </div>
                  <EzCheck
                    checked={contact.share_email}
                    disabled={contactSaving}
                    onChange={() => void toggleContact("share_email")}
                  >
                    {contact.share_email ? "On" : "Off"}
                  </EzCheck>
                </div>
                <div className="ez-list-row">
                  <div className="ez-list-row__main">
                    <span className="ez-strong">Share my phone with vendors</span>
                    <span className="ez-small">When you add a number to bookings</span>
                  </div>
                  <EzCheck
                    checked={contact.share_phone}
                    disabled={contactSaving}
                    onChange={() => void toggleContact("share_phone")}
                  >
                    {contact.share_phone ? "On" : "Off"}
                  </EzCheck>
                </div>
              </div>
            </div>
          ) : (
            <LottieFailureInline message="Could not load privacy settings." />
          )}

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Notifications</span>
            </div>
            <div className="ez-card__body">
              <Link href={portalRoute("client", "notifications")} className="ez-list-row">
                <span className="ez-avatar" aria-hidden>
                  <Bell size={18} />
                </span>
                <div className="ez-list-row__main">
                  <span className="ez-strong">All notifications</span>
                  <span className="ez-small">Booking updates and messages</span>
                </div>
                <ChevronRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "more" ? (
        <div className="ez-stack ez-stack--lg">
          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Shortcuts</span>
            </div>
            <div className="ez-card__body ez-stack ez-stack--sm">
              <Link href={portalRoute("client", "bookings")} className="ez-list-row">
                <CalendarDays size={18} aria-hidden />
                <div className="ez-list-row__main">
                  <span className="ez-strong">My bookings</span>
                  <span className="ez-small">Bookings and payments</span>
                </div>
                <ChevronRight size={18} aria-hidden />
              </Link>
              <Link href={portalRoute("client", "disputes")} className="ez-list-row">
                <ShieldAlert size={18} aria-hidden />
                <div className="ez-list-row__main">
                  <span className="ez-strong">Disputes</span>
                  <span className="ez-small">Open cases</span>
                </div>
                <ChevronRight size={18} aria-hidden />
              </Link>
            </div>
          </div>

          <div className="ez-card">
            <div className="ez-card__body">
              <p className="ez-small">
                <a href="/compliances/privacy-policy">Privacy policy</a>
                {" · "}
                <a href="/compliances/terms-of-service">Terms of service</a>
                {" · "}
                <a href="/compliances/cookies-policy">Cookies policy</a>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />

      <Modal
        isOpen={closeOpen}
        title="Close your account"
        onClose={() => {
          if (!closing) setCloseOpen(false);
        }}
      >
        <p className="ez-small">Enter your password to confirm. This cannot be undone.</p>
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          value={closePassword}
          onChange={(event) => setClosePassword(event.target.value)}
        />
        {closeError ? <LottieFailureInline message={closeError} /> : null}
        <div className="ez-hrow" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="ez-btn ez-btn--secondary"
            disabled={closing}
            onClick={() => setCloseOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="ez-btn ez-btn--danger-quiet"
            disabled={closing}
            onClick={() => void closeAccount()}
          >
            {closing ? "Closing…" : "Close account"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
