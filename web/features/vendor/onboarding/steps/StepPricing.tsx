"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import {
  packageIncludedPlaceholder,
  packageNamePlaceholder,
} from "../packageExamples";
import { packageFieldErrors } from "../packageQuality";
import {
  createVendorPackage,
  type VendorOnboardingData,
  type VendorOnboardingUpdate,
  type VendorPackageItem,
} from "../types";
import { VendorListingOptimizerPanel } from "@/features/vendor/copilot/VendorListingOptimizerPanel";
import { PackageExamplesModal } from "../ui/PackageExamplesModal";
import { consumeCoachScrollTarget } from "../packageCoachApply";
import { EzCheck, EzTextField } from "./ez-form";
import { singleGbpAmountFieldError } from "@/lib/validation/money";
import {
  damageDepositError,
  deliverySplitErrors,
  offersDamageDeposit,
  offersDeliverySplit,
} from "@/features/bookings/bookingTerms";
import policy from "@/lib/policyConstants.json";
import {
  PACKAGE_PRICING_MODE_FIXED,
  PACKAGE_PRICING_MODE_PER_UNIT,
  isPerUnitPricing,
  parsePackagePricingMode,
  type PackagePricingMode,
} from "@/lib/packagePricing";

export type StepPricingProps = {
  data: VendorOnboardingData;
  update: VendorOnboardingUpdate;
  /** Approved live profile: use the post-launch growth optimizer instead of the onboarding coach. */
  usePostLaunchOptimizer?: boolean;
  /** Wizard artboard omits the large “What is a package?” call-to-action. */
  showPackageExamples?: boolean;
  /** V04 artboard shows only offer name and off-peak discount. */
  useOnboardingLayout?: boolean;
};

/** Returns `packages` with the package `id` patched. */
function updatePackage(
  packages: VendorPackageItem[],
  id: string,
  patch: Partial<VendorPackageItem>,
): VendorPackageItem[] {
  return packages.map((item) =>
    item.id === id ? { ...item, ...patch } : item,
  );
}

/** Discount fields that, once any holds a value, switch `offerDiscounts` on. */
type DiscountFields = Pick<
  VendorOnboardingData,
  | "discountLabel"
  | "discountPercentage"
  | "bulkDiscountThreshold"
  | "bulkDiscountPercent"
  | "offPeakDiscountPercent"
>;

/** True when any discount field has text, so the saved flag follows what the vendor typed. */
function hasAnyDiscount(fields: DiscountFields): boolean {
  return Object.values(fields).some((value) => value.trim().length > 0);
}

/**
 * Step 4 (design V04): packages, prices and discounts. Hourly and daily rates, the photography
 * payout split and the damage deposit appear only when they apply or are already set.
 */
export function StepPricing({
  data,
  update,
  usePostLaunchOptimizer = false,
  showPackageExamples = false,
  useOnboardingLayout = true,
}: StepPricingProps) {
  const { packages } = data;
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const [highlightedPackageIds, setHighlightedPackageIds] = useState<string[]>(
    [],
  );
  const primaryService = data.servicesOffered[0];

  useEffect(() => {
    const { scrollToId, highlightIds } = consumeCoachScrollTarget();
    if (scrollToId) {
      setScrollTargetId(scrollToId);
      setHighlightedPackageIds(
        highlightIds.length ? highlightIds : [scrollToId],
      );
      window.setTimeout(() => setHighlightedPackageIds([]), 8000);
    }
  }, []);

  useEffect(() => {
    if (!scrollTargetId) return;
    const id = scrollTargetId;
    requestAnimationFrame(() => {
      document.getElementById(`package-${id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setScrollTargetId(null);
    });
  }, [scrollTargetId, packages]);

  const addPackage = () => {
    const newPkg = createVendorPackage();
    update({ packages: [...packages, newPkg] });
    setScrollTargetId(newPkg.id);
  };

  const removePackage = (id: string) => {
    if (packages.length <= 1) return;
    update({ packages: packages.filter((item) => item.id !== id) });
  };

  /** Packages whose less common options (quantity limits, hire period, travel rule) are opened. */
  const [openExtraIds, setOpenExtraIds] = useState<string[]>([]);
  const [showRates, setShowRates] = useState(false);
  const ratesVisible =
    showRates || data.hourlyRate.trim() !== "" || data.dailyRate.trim() !== "";

  /** Merges a discount change and keeps `offerDiscounts` in step with the fields. */
  const updateDiscount = (patch: Partial<DiscountFields>) => {
    const next: DiscountFields = {
      discountLabel: data.discountLabel,
      discountPercentage: data.discountPercentage,
      bulkDiscountThreshold: data.bulkDiscountThreshold,
      bulkDiscountPercent: data.bulkDiscountPercent,
      offPeakDiscountPercent: data.offPeakDiscountPercent,
      ...patch,
    };
    update({ ...patch, offerDiscounts: hasAnyDiscount(next) });
  };

  const hourlyRateError = data.hourlyRate.trim()
    ? singleGbpAmountFieldError(data.hourlyRate, "Hourly rate", {
        required: false,
      })
    : null;
  const dailyRateError = data.dailyRate.trim()
    ? singleGbpAmountFieldError(data.dailyRate, "Daily rate", {
        required: false,
      })
    : null;

  const showDeliverySplit = offersDeliverySplit(data.servicesOffered);
  const showDeposit = offersDamageDeposit(data.servicesOffered);
  const splitErrors = deliverySplitErrors(
    data.deliveryUpfrontPercent,
    data.deliveryDeadlineDays,
  );
  const depositError = damageDepositError(data.damageDepositGbp);

  return (
    <div className="ez-stack">
      <div className="ez-stack">
        <div className="ez-between">
          <h3 className="ez-h3">Your items / packages</h3>
          {ratesVisible ? null : (
            <button
              type="button"
              className="ez-link"
              onClick={() => setShowRates(true)}
            >
              Add hourly or daily rates
            </button>
          )}
        </div>

        {ratesVisible ? (
          <div className="ez-form-grid">
            <EzTextField
              label="Hourly rate (£ per hour)"
              inputMode="decimal"
              value={data.hourlyRate}
              onChange={(value) => update({ hourlyRate: value })}
              placeholder="e.g. 75"
              error={hourlyRateError}
            />
            <EzTextField
              label="Daily rate (£ per day)"
              inputMode="decimal"
              value={data.dailyRate}
              onChange={(value) => update({ dailyRate: value })}
              placeholder="e.g. 500"
              error={dailyRateError}
            />
            <EzCheck
              checked={data.useDefaultTravelHourly}
              onChange={(checked) =>
                update({ useDefaultTravelHourly: checked })
              }
            >
              Use default travel rule for hourly work
            </EzCheck>
            <EzCheck
              checked={data.useDefaultTravelDaily}
              onChange={(checked) => update({ useDefaultTravelDaily: checked })}
            >
              Use default travel rule for daily work
            </EzCheck>
          </div>
        ) : null}

        {showDeliverySplit ? (
          <div className="ez-stack">
            <h3 className="ez-h3">Two-part payout for photos and video</h3>
            <p className="ez-small">
              {`You get the first part after the event, and the rest once the client confirms they have their photos or video (or your delivery deadline passes). Leave a box blank to use ${policy.deliveryUpfrontPercentDefault}% and ${policy.deliveryDeadlineDaysDefault} days.`}
            </p>
            <div className="ez-form-grid">
              <EzTextField
                label={`Paid after the event (%, ${policy.deliveryUpfrontPercentMin} to ${policy.deliveryUpfrontPercentMax})`}
                inputMode="numeric"
                value={data.deliveryUpfrontPercent}
                onChange={(value) => update({ deliveryUpfrontPercent: value })}
                placeholder={`${policy.deliveryUpfrontPercentDefault}`}
                error={splitErrors.upfront}
              />
              <EzTextField
                label={`Days to deliver (1 to ${policy.deliveryDeadlineDaysMax})`}
                inputMode="numeric"
                value={data.deliveryDeadlineDays}
                onChange={(value) => update({ deliveryDeadlineDays: value })}
                placeholder={`${policy.deliveryDeadlineDaysDefault}`}
                error={splitErrors.deadline}
              />
            </div>
          </div>
        ) : null}

        {showDeposit ? (
          <div className="ez-stack">
            <h3 className="ez-h3">
              Refundable damage deposit{" "}
              <span className="ez-label__opt">(optional)</span>
            </h3>
            <EzTextField
              label="Deposit (£)"
              inputMode="decimal"
              value={data.damageDepositGbp}
              onChange={(value) => update({ damageDepositGbp: value })}
              placeholder="e.g. 100"
              help={`Clients get it back within ${policy.depositClaimDays} days after the event unless you report damage. Up to £${policy.depositMaxGbp.toLocaleString("en-GB")}.`}
              error={depositError}
            />
          </div>
        ) : null}

        {packages.map((pkg, index) => {
          const errors = packageFieldErrors(pkg, { strict: true });
          const perUnit = isPerUnitPricing(pkg.pricingMode);
          const extrasInUse =
            (pkg.duration !== "" && perUnit) ||
            !(pkg.useDefaultTravelPackage ?? true) ||
            Boolean(errors.minQuantity || errors.maxQuantity);
          const extrasVisible = extrasInUse || openExtraIds.includes(pkg.id);
          const isHighlighted = highlightedPackageIds.includes(pkg.id);
          const patch = (change: Partial<VendorPackageItem>) =>
            update({ packages: updatePackage(packages, pkg.id, change) });
          return (
            <div
              key={pkg.id}
              id={`package-${pkg.id}`}
              className="ez-card ez-card--flat"
              style={
                isHighlighted
                  ? { borderColor: "#34d399", scrollMarginTop: 16 }
                  : { scrollMarginTop: 16 }
              }
            >
              <div className="ez-card__body ez-stack">
                <div className="ez-between">
                  <span className="ez-strong">Package {index + 1}</span>
                  <div className="ez-hrow">
                    {extrasVisible ? null : (
                      <button
                        type="button"
                        className="ez-link"
                        onClick={() =>
                          setOpenExtraIds([...openExtraIds, pkg.id])
                        }
                      >
                        More options
                      </button>
                    )}
                    {packages.length > 1 ? (
                      <button
                        className="ez-icon-btn"
                        type="button"
                        aria-label={`Remove package ${index + 1}`}
                        onClick={() => removePackage(pkg.id)}
                      >
                        <Trash2 strokeWidth={1.75} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="ez-form-grid">
                  <EzTextField
                    label="Package name"
                    value={pkg.title}
                    onChange={(value) => patch({ title: value })}
                    placeholder={packageNamePlaceholder(primaryService)}
                    error={errors.title}
                  />
                  <div className="ez-field">
                    <label
                      className="ez-label"
                      htmlFor={`pricing-type-${pkg.id}`}
                    >
                      Pricing type
                    </label>
                    <div className="ez-select-wrap">
                      <select
                        className="ez-input ez-select"
                        id={`pricing-type-${pkg.id}`}
                        value={parsePackagePricingMode(pkg.pricingMode)}
                        onChange={(event) =>
                          patch({
                            pricingMode: event.target
                              .value as PackagePricingMode,
                          })
                        }
                      >
                        <option value={PACKAGE_PRICING_MODE_FIXED}>
                          Fixed price
                        </option>
                        <option value={PACKAGE_PRICING_MODE_PER_UNIT}>
                          {primaryService === "catering" ? "Per person" : "Price per item"}
                        </option>
                      </select>
                      <ChevronDown strokeWidth={1.75} aria-hidden />
                    </div>
                  </div>
                  <EzTextField
                    label="Price (£)"
                    value={pkg.price}
                    onChange={(value) => patch({ price: value })}
                    help="One amount, not a range."
                    error={errors.price}
                  />
                  {perUnit ? (
                    <EzTextField
                      label="Unit name"
                      value={pkg.unitLabel}
                      onChange={(value) => patch({ unitLabel: value })}
                      placeholder="e.g. chair, table, person"
                      error={errors.unitLabel}
                    />
                  ) : null}
                </div>
                <EzTextField
                  label="What is included"
                  multiline
                  value={pkg.details}
                  onChange={(value) => patch({ details: value })}
                  placeholder={packageIncludedPlaceholder(primaryService)}
                  error={errors.details}
                />
                {extrasVisible ? (
                  <>
                    {perUnit ? null : (
                      <div className="ez-form-grid">
                        <EzTextField
                          label="Duration (optional)"
                          value={pkg.duration}
                          onChange={(value) => patch({ duration: value })}
                          placeholder="e.g. 2 hr coverage"
                        />
                      </div>
                    )}
                    {perUnit ? (
                      <div className="ez-form-grid">
                        <EzTextField
                          label="Min quantity (optional)"
                          inputMode="numeric"
                          value={pkg.minQuantity}
                          onChange={(value) => patch({ minQuantity: value })}
                          placeholder="e.g. 10"
                          error={errors.minQuantity}
                        />
                        <EzTextField
                          label="Max quantity (optional)"
                          inputMode="numeric"
                          value={pkg.maxQuantity}
                          onChange={(value) => patch({ maxQuantity: value })}
                          placeholder="e.g. 200"
                          error={errors.maxQuantity}
                        />
                        <EzTextField
                          label="Hire period (optional)"
                          value={pkg.duration}
                          onChange={(value) => patch({ duration: value })}
                          placeholder="e.g. 3-day hire"
                        />
                      </div>
                    ) : null}
                    <EzCheck
                      checked={pkg.useDefaultTravelPackage ?? true}
                      onChange={(checked) =>
                        patch({ useDefaultTravelPackage: checked })
                      }
                    >
                      Use the default travel and delivery rule from Location
                    </EzCheck>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        <button
          className="ez-btn ez-btn--secondary"
          type="button"
          onClick={addPackage}
        >
          <Plus strokeWidth={1.75} aria-hidden />
          Add another package
        </button>
        {showPackageExamples ? (
          <PackageExamplesModal servicesOffered={data.servicesOffered} />
        ) : null}
        {usePostLaunchOptimizer ? (
          <VendorListingOptimizerPanel data={data} update={update} />
        ) : null}
      </div>

      <hr className="ez-divider" />

      <div className="ez-stack">
        <h3 className="ez-h3">
          Discounts <span className="ez-label__opt">(optional)</span>
        </h3>
        <div className="ez-form-grid">
          <EzTextField
            label="Offer name"
            value={data.discountLabel}
            onChange={(value) => updateDiscount({ discountLabel: value })}
            placeholder="e.g. Easter discount"
          />
          <EzTextField
            label="Off-peak discount (%)"
            value={data.offPeakDiscountPercent}
            onChange={(value) =>
              updateDiscount({ offPeakDiscountPercent: value })
            }
          />
          {useOnboardingLayout ? null : (
            <>
              <EzTextField
                label="Percentage off (%)"
                value={data.discountPercentage}
                onChange={(value) => updateDiscount({ discountPercentage: value })}
                placeholder="10"
              />
              <EzTextField
                label="Bulk booking threshold (£)"
                value={data.bulkDiscountThreshold}
                onChange={(value) =>
                  updateDiscount({ bulkDiscountThreshold: value })
                }
                placeholder="500"
              />
              <EzTextField
                label="Bulk booking discount (%)"
                value={data.bulkDiscountPercent}
                onChange={(value) => updateDiscount({ bulkDiscountPercent: value })}
                placeholder="10"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
