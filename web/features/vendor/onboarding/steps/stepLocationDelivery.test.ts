import { describe, expect, it } from "vitest";
import { isDeliveryModeActive, toggleDeliveryMode } from "./StepLocation";

describe("delivery mode checkboxes", () => {
  it("marks only the modes that are actually stored", () => {
    const modes = ["travel_to_client", "client_comes"] as const;

    expect(isDeliveryModeActive([...modes], "travel_to_client")).toBe(true);
    expect(isDeliveryModeActive([...modes], "client_comes")).toBe(true);
    expect(isDeliveryModeActive([...modes], "travel_both")).toBe(false);
    expect(isDeliveryModeActive([...modes], "ship_to_client")).toBe(false);
  });

  it("toggles the clicked option and leaves the others selected", () => {
    expect(toggleDeliveryMode(["client_comes"], "travel_to_client")).toEqual([
      "client_comes",
      "travel_to_client",
    ]);
    expect(toggleDeliveryMode(["travel_to_client", "client_comes"], "travel_to_client")).toEqual([
      "client_comes",
    ]);
    expect(toggleDeliveryMode(["travel_both"], "ship_to_client")).toEqual([
      "travel_both",
      "ship_to_client",
    ]);
  });
});
