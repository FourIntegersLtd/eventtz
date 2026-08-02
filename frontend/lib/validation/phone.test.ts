import { describe, expect, it } from "vitest";
import { isValidPhoneNumber, phoneRequiredSchema } from "@/lib/validation/phone";

describe("isValidPhoneNumber", () => {
  it("accepts UK mobile formats", () => {
    expect(isValidPhoneNumber("07123456789")).toBe(true);
    expect(isValidPhoneNumber("07123 456789")).toBe(true);
    expect(isValidPhoneNumber("+44 7123 456789")).toBe(true);
    expect(isValidPhoneNumber("+447123456789")).toBe(true);
  });

  it("accepts UK landline formats", () => {
    expect(isValidPhoneNumber("02079460000")).toBe(true);
    expect(isValidPhoneNumber("020 7946 0000")).toBe(true);
  });

  it("rejects too short or empty values", () => {
    expect(isValidPhoneNumber("")).toBe(false);
    expect(isValidPhoneNumber("12345")).toBe(false);
    expect(isValidPhoneNumber("abc")).toBe(false);
  });

  it("rejects invalid international prefixes", () => {
    expect(isValidPhoneNumber("+44")).toBe(false);
    expect(isValidPhoneNumber("+1")).toBe(false);
  });
});

describe("phoneRequiredSchema", () => {
  it("returns a helpful message for invalid input", () => {
    const result = phoneRequiredSchema.safeParse("not-a-phone");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/valid phone number/i);
    }
  });
});
