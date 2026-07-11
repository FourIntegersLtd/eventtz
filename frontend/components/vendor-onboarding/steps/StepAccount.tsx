import type { VendorOnboardingData, VendorOnboardingUpdate } from "../types";
import { inputClass, labelClass } from "./form-primitives";

export type StepAccountProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
};

export function StepAccount({ data, update }: StepAccountProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold text-neutral-900">
          Account details
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Your personal contact information.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass()}>First name</label>
          <input
            className={inputClass()}
            value={data.firstName}
            onChange={(e) => update({ firstName: e.target.value })}
            autoComplete="given-name"
          />
        </div>
        <div>
          <label className={labelClass()}>Last name</label>
          <input
            className={inputClass()}
            value={data.lastName}
            onChange={(e) => update({ lastName: e.target.value })}
            autoComplete="family-name"
          />
        </div>
      </div>
      <div>
        <label className={labelClass()}>Phone number</label>
        <input
          type="tel"
          className={inputClass()}
          value={data.phone}
          onChange={(e) => update({ phone: e.target.value })}
          autoComplete="tel"
        />
      </div>
    </div>
  );
}
