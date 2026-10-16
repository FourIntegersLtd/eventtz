import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  captureVendorReferralFromSearchParams,
  formatVendorReferralCodeInput,
  getStoredVendorReferralCode,
  normalizeVendorReferralCode,
  persistVendorReferralCode,
  VENDOR_REFERRAL_CODE_MAX_LEN,
} from "@/lib/vendorReferralAttribution";

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
    vi.stubGlobal("window", { sessionStorage });
    vi.stubGlobal("sessionStorage", sessionStorage);
    sessionStorage.clear();
  });

  it("normalizes numeric referral codes up to 6 digits", () => {
    expect(normalizeVendorReferralCode("  482910 ")).toBe("482910");
    expect(normalizeVendorReferralCode("48-29-10")).toBe("482910");
    expect(normalizeVendorReferralCode("1234567")).toBeNull();
    expect(normalizeVendorReferralCode("!!!")).toBeNull();
  });

  it("formats input to digits only with max length", () => {
    expect(formatVendorReferralCodeInput("ab12cd34ef")).toBe("1234");
    expect(formatVendorReferralCodeInput("1234567890").length).toBe(VENDOR_REFERRAL_CODE_MAX_LEN);
  });

  it("stores referral per vendor in sessionStorage", () => {
    persistVendorReferralCode("vendor-1", "482910");
    expect(getStoredVendorReferralCode("vendor-1")).toBe("482910");
    expect(getStoredVendorReferralCode("vendor-2")).toBeNull();
  });

  it("captures vref from URL search params", () => {
    const params = new URLSearchParams("vref=482910");
    expect(captureVendorReferralFromSearchParams("vendor-1", params)).toBe("482910");
    expect(getStoredVendorReferralCode("vendor-1")).toBe("482910");
  });
});
