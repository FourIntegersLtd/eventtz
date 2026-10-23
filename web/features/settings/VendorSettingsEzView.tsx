"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Copy, Gift, Lock } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/components/ui/Toast";
import { LoadingState } from "@/components/ui/LoadingState";
import { LottieFailureInline } from "@/components/ui/LottieFailureInline";
import { Modal } from "@/components/ui/Modal";
import { PasswordField } from "@/components/ui/PasswordField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Checkbox } from "@/components/ui/Checkbox";
import { TextField } from "@/components/ui/TextField";
import { initialVendorOnboardingData, type VendorOnboardingData } from "@/lib/vendorOnboarding/types";
import {
  mergePayloadIntoVendorData,
  normalizeVendorPayload,
  vendorDataToPayload,
} from "@/features/vendor/onboarding/serializeVendorPayload";
import { fetchVendorProfile, saveVendorProfile } from "@/lib/vendorProfileApi";
import { getApiErrorDetail } from "@/lib/api-errors";
import { deleteAccountSchema, parseForm } from "@/lib/validation";
import { isValidPhoneNumber } from "@/lib/validation/phone";
import { deleteOwnAccount, fetchContactSharingSettings, type ContactSharingSettings } from "@/lib/userSettingsApi";
import { deleteAccountErrorMessage } from "@/features/settings/SettingsDeleteAccountSection";
import { persistContactSharingToggle } from "@/features/settings/ContactSharingSettingsSection";
import {
  referralUnavailableError,
  withCreatedReferralCode,
} from "@/features/settings/SettingsReferralsSection";
import {
  formatVendorReferralCodeInput,
  VENDOR_REFERRAL_CODE_MAX_LEN,
} from "@/lib/vendorReferralAttribution";
import { formatEventDate } from "@/lib/dateFormat";
import { resetMixpanel } from "@/lib/mixpanelClient";
import { useRouter } from "next/navigation";
import { ChangePasswordModal } from "@/features/settings/ChangePasswordModal";
import { TablePagination } from "@/components/ui/TablePagination";
import {
  fetchVendorClientReferral,
  fetchVendorReferralBookingsPage,
  setVendorReferralCode,
  VENDOR_REFERRAL_BOOKINGS_PAGE_SIZE,
  type VendorClientReferralInfo,
  type VendorReferralBookingRow,
} from "@/lib/vendorReferralsApi";

function referralStatusBadge(status: string): { label: string; className: string } {
  const normalized = status.toLowerCase();
  if (normalized === "completed" || normalized === "accepted") {
    return { label: "Approved", className: "ez-badge ez-badge--success" };
  }
  if (normalized === "pending" || normalized === "quoted") {
    return { label: "In review", className: "ez-badge ez-badge--warning" };
  }
  return { label: status || "Invited", className: "ez-badge ez-badge--neutral" };
}

/**
 * Vendor settings (design V31): one page for account, notifications, security,
 * closing the account, and the client referral link. Client settings stay on
 * the tabbed `SettingsView`.
 */
export function VendorSettingsEzView() {
  const { user, refreshUser, signOut } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "referrals" ? "referrals" : "account";
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [profileStep, setProfileStep] = useState(1);
  const [data, setData] = useState<VendorOnboardingData>(initialVendorOnboardingData);
  const [saving, setSaving] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closePassword, setClosePassword] = useState("");
  const [closeError, setCloseError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [contact, setContact] = useState<ContactSharingSettings | null>(null);
  const [contactSaving, setContactSaving] = useState(false);
  const [referral, setReferral] = useState<VendorClientReferralInfo | null>(null);
  const [referralRows, setReferralRows] = useState<VendorReferralBookingRow[]>([]);
  const [referralBookingsOffset, setReferralBookingsOffset] = useState(0);
  const [referralBookingsTotal, setReferralBookingsTotal] = useState(0);
  const [referralUnavailable, setReferralUnavailable] = useState(false);
  const [referralLoading, setReferralLoading] = useState(true);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [draftReferralCode, setDraftReferralCode] = useState("");
  const [referralSaving, setReferralSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await fetchVendorProfile();
        if (cancelled) return;
        const merged = mergePayloadIntoVendorData(
          normalizeVendorPayload(profile.profile_form_data),
          user?.email ?? "",
        );
        setProfileStep(profile.current_step || 1);
        setData({
          ...initialVendorOnboardingData,
          ...merged,
          email: merged.email?.trim() || user?.email || "",
          password: "",
        });
      } catch {
        if (!cancelled) setLoadError("Could not load your account.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    void fetchContactSharingSettings()
      .then((settings) => {
        if (!cancelled) setContact(settings);
      })
      .catch(() => undefined);
    setReferralLoading(true);
    setReferralError(null);
    void fetchVendorClientReferral()
      .then((info) => {
        if (cancelled) return;
        setReferral(info);
        setDraftReferralCode(info.referral_code || "");
        setReferralUnavailable(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (referralUnavailableError(err)) {
          setReferralUnavailable(true);
          return;
        }
        setReferralError("Could not load your referral link.");
      })
      .finally(() => {
        if (!cancelled) setReferralLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    if (tab !== "referrals") return;
    let cancelled = false;
    void fetchVendorReferralBookingsPage(
      referralBookingsOffset,
      VENDOR_REFERRAL_BOOKINGS_PAGE_SIZE,
    )
      .then((bookings) => {
        if (cancelled) return;
        setReferralRows(bookings.bookings);
        setReferralBookingsTotal(bookings.total ?? bookings.total_referral_bookings);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (referralUnavailableError(err)) setReferralUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, referralBookingsOffset]);

  const saveAccount = async () => {
    if (!data.firstName.trim() || !data.lastName.trim()) {
      showToast({ title: "Enter your first and last name", tone: "error" });
      return;
    }
    if (!isValidPhoneNumber(data.phone.trim())) {
      setPhoneError("Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx).");
      return;
    }
    setSaving(true);
    setPhoneError(null);
    try {
      const res = await saveVendorProfile({
        current_step: profileStep,
        profile_form_data: vendorDataToPayload({ ...data, email: user?.email ?? data.email }),
      });
      setProfileStep(res.current_step || profileStep);
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
      showToast({ title: "Contact preferences saved", tone: "success" });
    } catch {
      showToast({ title: "Could not save contact preferences", tone: "error" });
    } finally {
      setContactSaving(false);
    }
  };

  const copyLink = async () => {
    const link = referral?.share_link;
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast({ title: "Link copied", tone: "success" });
    } catch {
      showToast({ title: "Could not copy the link", tone: "error" });
    }
  };

  const createReferralCode = async () => {
    setReferralSaving(true);
    try {
      const trimmed = draftReferralCode.trim();
      const result = await setVendorReferralCode(
        trimmed ? { code: trimmed } : { generate: true },
      );
      const fresh = await fetchVendorClientReferral().catch(() => null);
      setReferral(fresh ?? withCreatedReferralCode(referral, result));
      setDraftReferralCode(result.referral_code);
      showToast({ title: "Referral code created", tone: "success" });
    } catch {
      showToast({
        title: "Could not create a referral code",
        description: "Use 1 to 6 digits, or leave blank for a random code.",
        tone: "error",
      });
    } finally {
      setReferralSaving(false);
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
        /* cookies already cleared */
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

  if (loadError) {
    return <LottieFailureInline message={loadError} />;
  }

  const hasReferralCode = Boolean(referral?.has_referral_code && referral.referral_code);
  const invited = referralBookingsTotal;
  const approved = referralRows.filter((row) => {
    const status = row.booking_status.toLowerCase();
    return status === "accepted" || status === "completed";
  }).length;

  return (
    <div className="ez-stack ez-stack--lg">
      <PageHeader descriptionSize="body"
        eyebrow="Account"
        title="Settings"
        description="Your sign-in, notifications and referrals."
      />

      <div className="ez-tabs" role="tablist">
        <Link className={`ez-tab${tab === "account" ? " ez-tab--active" : ""}`} href="/vendor/settings">
          Account
        </Link>
        <Link className={`ez-tab${tab === "referrals" ? " ez-tab--active" : ""}`} href="/vendor/settings?tab=referrals">
          Referrals
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
                <TextField
                  label="First name"
                  value={data.firstName}
                  autoComplete="given-name"
                  onChange={({ target: { value } }) => setData((prev) => ({ ...prev, firstName: value }))}
                />
                <TextField
                  label="Last name"
                  value={data.lastName}
                  autoComplete="family-name"
                  onChange={({ target: { value } }) => setData((prev) => ({ ...prev, lastName: value }))}
                />
                <TextField
                  label="Email"
                  type="email"
                  value={user?.email ?? data.email}
                  readOnly
                  onChange={() => undefined}
                />
                <TextField
                  label="Phone number"
                  type="tel"
                  value={data.phone}
                  autoComplete="tel"
                  error={phoneError}
                  onChange={({ target: { value } }) => {
                    setData((prev) => ({ ...prev, phone: value }));
                    setPhoneError(null);
                  }}
                />
              </div>
            </div>
            <div className="ez-card__foot">
              <button className="ez-btn ez-btn--primary" type="button" disabled={saving} onClick={() => void saveAccount()}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Notifications</span>
            </div>
            <div className="ez-card__body">
              <div className="ez-list-row">
                <div className="ez-list-row__main">
                  <span className="ez-strong">New enquiries</span>
                  <span className="ez-small">Email and in-app</span>
                </div>
                <Checkbox
                  checked={data.emailOnEnquiry}
                  onChange={(checked) => setData((prev) => ({ ...prev, emailOnEnquiry: checked }))}
                >
                  {data.emailOnEnquiry ? "On" : "Off"}
                </Checkbox>
              </div>
              <div className="ez-list-row">
                <div className="ez-list-row__main">
                  <span className="ez-strong">Payments and payouts</span>
                  <span className="ez-small">Always on for security</span>
                </div>
                <Checkbox checked disabled onChange={() => undefined}>
                  On
                </Checkbox>
              </div>
              <p className="ez-caption" style={{ marginTop: 8 }}>
                Enquiry emails save with Save changes. Payment emails cannot be turned off.
              </p>
            </div>
          </div>

          {contact ? (
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">What clients see after they pay</span>
              </div>
              <div className="ez-card__body">
                <div className="ez-list-row">
                  <div className="ez-list-row__main">
                    <span className="ez-strong">Share my email</span>
                    <span className="ez-small">{user?.email ?? "Your sign-in email"}</span>
                  </div>
                  <Checkbox
                    checked={contact.share_email}
                    disabled={contactSaving}
                    onChange={() => void toggleContact("share_email")}
                  >
                    {contact.share_email ? "On" : "Off"}
                  </Checkbox>
                </div>
                <div className="ez-list-row">
                  <div className="ez-list-row__main">
                    <span className="ez-strong">Share my phone</span>
                    <span className="ez-small">From your profile</span>
                  </div>
                  <Checkbox
                    checked={contact.share_phone}
                    disabled={contactSaving}
                    onChange={() => void toggleContact("share_phone")}
                  >
                    {contact.share_phone ? "On" : "Off"}
                  </Checkbox>
                </div>
              </div>
            </div>
          ) : null}

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Security</span>
            </div>
            <div className="ez-card__body">
              <div className="ez-lines">
                <div className="ez-lines__row">
                  <span>Sign-in</span>
                  <span>Email and password</span>
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="ez-btn ez-btn--secondary" type="button" onClick={() => setPasswordOpen(true)}>
                  <Lock size={18} strokeWidth={1.75} aria-hidden />
                  Change password
                </button>
              </div>
            </div>
          </div>

          <div className="ez-card">
            <div className="ez-card__head">
              <span className="ez-h3">Close account</span>
            </div>
            <div className="ez-card__body">
              <p className="ez-small">
                Closing is permanent. Open bookings must be completed or cancelled first, and held payouts will still be paid.
              </p>
            </div>
            <div className="ez-card__foot">
              <button className="ez-btn ez-btn--danger-quiet" type="button" onClick={() => setCloseOpen(true)}>
                Close my account
              </button>
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
      ) : (
      <div className="vendor-referrals-layout">
          <div className="ez-stack ez-stack--lg">
            <div className="ez-card">
              <div className="ez-card__head">
                <span className="ez-h3">Your referrals</span>
              </div>
              <div className="ez-card__body">
                <div className="ez-grid-2">
                  <div className="ez-kpi">
                    <span className="ez-kpi__label">Bookings</span>
                    <span className="ez-kpi__value">{invited}</span>
                  </div>
                  <div className="ez-kpi">
                    <span className="ez-kpi__label">Accepted</span>
                    <span className="ez-kpi__value">{approved}</span>
                  </div>
                </div>
                <div className="ez-table-wrap">
                  <table className="ez-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Event</th>
                        <th>Date</th>
                        <th className="ez-td-status">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referralRows.length === 0 ? (
                        <tr>
                          <td colSpan={4}>No referral bookings yet. When a client books with your link, they show up here.</td>
                        </tr>
                      ) : (
                        referralRows.map((row) => {
                          const badge = referralStatusBadge(row.booking_status);
                          return (
                            <tr key={row.booking_request_id}>
                              <td className="ez-td-strong">
                                <Link href={`/vendor/settings/referrals/${row.booking_request_id}`}>
                                  {row.client_display_name || "Client"}
                                </Link>
                              </td>
                              <td>{row.event_name}</td>
                              <td>{row.event_date ? formatEventDate(row.event_date) : "-"}</td>
                              <td className="ez-td-status">
                                <span className={badge.className}>{badge.label}</span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePagination
                  offset={referralBookingsOffset}
                  limit={VENDOR_REFERRAL_BOOKINGS_PAGE_SIZE}
                  total={referralBookingsTotal}
                  onPrevious={() =>
                    setReferralBookingsOffset((current) =>
                      Math.max(0, current - VENDOR_REFERRAL_BOOKINGS_PAGE_SIZE),
                    )
                  }
                  onNext={() =>
                    setReferralBookingsOffset((current) => current + VENDOR_REFERRAL_BOOKINGS_PAGE_SIZE)
                  }
                />
              </div>
            </div>

            <div className="ez-card">
              <div className="ez-card__body">
                <div className="ez-hrow">
                  <Gift size={20} strokeWidth={1.75} aria-hidden />
                  <div className="ez-small">
                    The client’s fee discount applies when they book with your code.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ez-card vendor-referrals-layout__share">
            <div className="ez-card__head">
              <span className="ez-h3">Refer a client</span>
            </div>
            <div className="ez-card__body ez-stack">
              {referralLoading ? (
                <LoadingState label="Loading referral link…" variant="inline" />
              ) : referralUnavailable ? (
                <p className="ez-small">Client referrals are available after Eventtz approves your listing.</p>
              ) : referralError ? (
                <LottieFailureInline message={referralError} />
              ) : hasReferralCode ? (
                <>
                  <p className="ez-small">
                    Share your link. When a client books with you through it, they save on the Eventtz service fee.
                  </p>
                  <p className="ez-strong" style={{ fontFamily: "var(--ez-font-mono, monospace)", letterSpacing: "0.12em" }}>
                    {referral?.referral_code}
                  </p>
                  {referral?.share_link ? (
                    <TextField
                      label="Your link"
                      value={referral.share_link}
                      readOnly
                      onChange={() => undefined}
                    />
                  ) : null}
                  <div className="ez-hrow">
                    <button
                      className="ez-btn ez-btn--secondary"
                      type="button"
                      style={{ marginLeft: "auto" }}
                      disabled={!referral?.share_link}
                      onClick={() => void copyLink()}
                    >
                      <Copy size={18} strokeWidth={1.75} aria-hidden />
                      Copy link
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="ez-small">
                    Choose a code once. It cannot be changed later. Leave blank for a random 6-digit code.
                  </p>
                  <TextField
                    label="Referral code (optional)"
                    value={draftReferralCode}
                    inputMode="numeric"
                    maxLength={VENDOR_REFERRAL_CODE_MAX_LEN}
                    placeholder={`Random, or 1–${VENDOR_REFERRAL_CODE_MAX_LEN} digits`}
                    onChange={({ target: { value } }) => setDraftReferralCode(formatVendorReferralCodeInput(value))}
                  />
                  <div className="ez-hrow">
                    <button
                      className="ez-btn ez-btn--secondary"
                      type="button"
                      style={{ marginLeft: "auto" }}
                      disabled={referralSaving}
                      onClick={() => void createReferralCode()}
                    >
                      {referralSaving ? "Creating…" : "Create referral code"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
      </div>
      )}

      <ChangePasswordModal isOpen={passwordOpen} onClose={() => setPasswordOpen(false)} />

      <Modal
        isOpen={closeOpen}
        onClose={() => {
          if (closing) return;
          setCloseOpen(false);
          setClosePassword("");
          setCloseError(null);
        }}
        title="Close your account?"
        maxWidthClassName="max-w-md"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button className="ez-btn ez-btn--secondary" type="button" disabled={closing} onClick={() => setCloseOpen(false)}>
              Keep account
            </button>
            <button className="ez-btn ez-btn--danger-quiet" type="button" disabled={closing || !closePassword.trim()} onClick={() => void closeAccount()}>
              {closing ? "Closing…" : "Close my account"}
            </button>
          </div>
        }
      >
        <p className="ez-small">
          This cannot be undone. You will be signed out. You can register again later with the same email; it will be a new account.
        </p>
        {closeError ? <LottieFailureInline message={closeError} className="mt-3" /> : null}
        <div className="mt-4">
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            value={closePassword}
            onChange={(event) => setClosePassword(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
