import { describe, expect, it } from "vitest";
import { adminBugReportSchema } from "@/lib/validation/contact";
import { parseForm } from "@/lib/validation/helpers";

describe("adminBugReportSchema", () => {
  it("accepts a message without an email field", () => {
    const parsed = parseForm(adminBugReportSchema, {
      message: "The vendor directory table is blank after I change the date filter.",
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.data).toEqual({
        message: "The vendor directory table is blank after I change the date filter.",
      });
    }
  });

  it("rejects a short message", () => {
    const parsed = parseForm(adminBugReportSchema, { message: "too short" });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) {
      expect(parsed.formError).toMatch(/10 characters/i);
    }
  });
});
