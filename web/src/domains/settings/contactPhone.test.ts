import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseContactPhone } from "@/domains/settings/contactPhone";

describe("parseContactPhone", () => {
  it("accepts an empty value and parses it to null", () => {
    assert.deepEqual(parseContactPhone(""), { ok: true, value: null });
  });

  it("trims and accepts a UK mobile number", () => {
    assert.deepEqual(parseContactPhone(" 07123456789 "), { ok: true, value: "07123456789" });
  });

  it("accepts an international number", () => {
    assert.deepEqual(parseContactPhone("+44 7123 456789"), { ok: true, value: "+44 7123 456789" });
  });

  it("rejects a too-short number", () => {
    assert.deepEqual(parseContactPhone("123"), {
      ok: false,
      error: "Enter a valid phone number (e.g. 07xxx xxxxxx or +44 7xxx xxxxxx).",
    });
  });

  it("rejects a number over the length cap", () => {
    assert.deepEqual(parseContactPhone("12345678901234567890123456789012345678901"), {
      ok: false,
      error: "Phone number is too long.",
    });
  });
});
