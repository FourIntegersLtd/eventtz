import axios from "axios";
import { describe, expect, it } from "vitest";
import { mediaUploadErrorMessage } from "./api-errors";

describe("mediaUploadErrorMessage", () => {
  it("returns API detail when present", () => {
    const err = new axios.AxiosError("bad", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 413,
      data: { detail: "File is too large (max 50MB)." },
      statusText: "Payload Too Large",
      headers: {},
      config: { headers: {} } as never,
    });
    expect(mediaUploadErrorMessage(err, "video")).toBe("File is too large (max 50MB).");
  });

  it("explains photo upload timeouts", () => {
    const err = new axios.AxiosError("timeout", "ECONNABORTED");
    expect(mediaUploadErrorMessage(err, "photo")).toMatch(/timed out/i);
    expect(mediaUploadErrorMessage(err, "photo")).toMatch(/Wi‑Fi/i);
  });

  it("explains video upload timeouts", () => {
    const err = new axios.AxiosError("timeout", "ECONNABORTED");
    expect(mediaUploadErrorMessage(err, "video")).toMatch(/Video upload timed out/i);
  });

  it("explains network failures", () => {
    const err = new axios.AxiosError("network", "ERR_NETWORK");
    expect(mediaUploadErrorMessage(err, "photo")).toMatch(/internet connection/i);
  });
});
