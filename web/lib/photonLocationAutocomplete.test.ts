import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocodeLocation } from "@/lib/photonLocationAutocomplete";

describe("reverseGeocodeLocation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns formatted city label from Photon reverse response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                name: "Leeds",
                city: "Leeds",
                state: "West Yorkshire",
                countrycode: "GB",
              },
            },
          ],
        }),
      }),
    );

    const label = await reverseGeocodeLocation(53.8, -1.55, { countryCode: "GB" });
    expect(label).toBe("Leeds, West Yorkshire");
  });

  it("returns null when no matching country feature is found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                name: "Paris",
                countrycode: "FR",
              },
            },
          ],
        }),
      }),
    );

    const label = await reverseGeocodeLocation(48.85, 2.35, { countryCode: "GB" });
    expect(label).toBeNull();
  });

  it("returns null for invalid coordinates", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await reverseGeocodeLocation(Number.NaN, 0)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
