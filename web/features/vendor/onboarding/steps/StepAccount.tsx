"use client";

import { useState } from "react";
import type { VendorOnboardingData, VendorOnboardingUpdate } from "../../../../lib/vendorOnboarding/types";
import { EzCheck, EzTextField } from "../../../../components/ui/ez-form";
import { isValidPhoneNumber } from "@/lib/validation/phone";

export type StepAccountProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  phoneError: string | null;
  setPhoneError: (v: string | null) => void;
};

export function StepAccount({
  data,
  update,
  phoneError,
  setPhoneError,
}: StepAccountProps) {
  const [phoneVerified, setPhoneVerified] = useState<boolean | null>(null);

  const verifyPhone = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setPhoneError(null);
      setPhoneVerified(null);
      return;
    }
    if (isValidPhoneNumber(trimmed)) {
      setPhoneError(null);
      setPhoneVerified(true);
    } else {
      setPhoneError("Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx).");
      setPhoneVerified(false);
    }
  };

  return (
    <div className="ez-stack">
      <div className="ez-form-grid">
        <EzTextField
          label="First name"
          value={data.firstName}
          onChange={(value) => update({ firstName: value })}
          autoComplete="given-name"
        />
        <EzTextField
          label="Last name"
          value={data.lastName}
          onChange={(value) => update({ lastName: value })}
          autoComplete="family-name"
        />
      </div>
      <EzTextField
        label="Phone number"
        type="tel"
        value={data.phone}
        onChange={(value) => {
          update({ phone: value });
          setPhoneError(null);
          setPhoneVerified(null);
        }}
        onBlur={() => verifyPhone(data.phone)}
        autoComplete="tel"
        error={phoneError}
        help={
          phoneVerified
            ? "Phone number looks good. Clients see it only after they have booked you."
            : "UK mobile or landline. Include +44 for international numbers."
        }
      />
      <EzTextField
        label="Email"
        type="email"
        value={data.email}
        onChange={() => undefined}
        readOnly
        help="This is your sign-in email. Change it in Settings."
      />
      <EzCheck
        checked={data.emailOnEnquiry}
        onChange={(checked) => update({ emailOnEnquiry: checked })}
      >
        Email me when a client sends an enquiry (recommended)
      </EzCheck>
    </div>
  );
}
