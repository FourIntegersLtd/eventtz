import { describe, expect, it } from "vitest";
import { composePlannerPrompt, EMPTY_PLANNER_FORM } from "./plannerFormModel";

describe("composePlannerPrompt", () => {
  it("uses the details field when provided", () => {
    expect(
      composePlannerPrompt({
        ...EMPTY_PLANNER_FORM,
        details: "Surprise party with a live band.",
      }),
    ).toBe("Surprise party with a live band.");
  });

  it("builds a prompt from structured fields", () => {
    expect(
      composePlannerPrompt({
        ...EMPTY_PLANNER_FORM,
        eventType: "birthday",
        location: "London",
        guestCount: "120",
        budget: "5000",
        preferredDate: "2026-11-14",
      }),
    ).toBe(
      "Help me plan my birthday in London for about 120 guests with a budget of £5000 on 2026-11-14.",
    );
  });
});
