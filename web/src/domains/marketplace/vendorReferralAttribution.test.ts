import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  captureVendorReferralFromSearchParams,
  formatVendorReferralCodeInput,
  getStoredVendorReferralCode,
  normalizeVendorReferralCode,
  persistVendorReferralCode,
  VENDOR_REFERRAL_CODE_MAX_LEN,
} from "./vendorReferralAttribution";

describe("vendorReferralAttribution", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const sessionStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    };
    Object.defineProperty(globalThis, "sessionStorage", {
      value: sessionStorage,
      configurable: true,
      writable: true,
    });
  });

  it("normalizes numeric referral codes up to 6 digits", () => {
    assert.equal(normalizeVendorReferralCode("  482910 "), "482910");
    assert.equal(normalizeVendorReferralCode("48-29-10"), "482910");
    assert.equal(normalizeVendorReferralCode("1234567"), null);
    assert.equal(normalizeVendorReferralCode("!!!"), null);
  });

  it("formats input to digits only with max length", () => {
    assert.equal(formatVendorReferralCodeInput("ab12cd34ef"), "1234");
    assert.equal(formatVendorReferralCodeInput("1234567890").length, VENDOR_REFERRAL_CODE_MAX_LEN);
  });

  it("stores referral per vendor in sessionStorage", () => {
    persistVendorReferralCode("vendor-1", "482910");
    assert.equal(getStoredVendorReferralCode("vendor-1"), "482910");
    assert.equal(getStoredVendorReferralCode("vendor-2"), null);
  });

  it("captures vref from URL search params", () => {
    const params = new URLSearchParams("vref=482910");
    assert.equal(captureVendorReferralFromSearchParams("vendor-1", params), "482910");
    assert.equal(getStoredVendorReferralCode("vendor-1"), "482910");
  });
});
