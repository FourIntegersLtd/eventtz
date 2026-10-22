import axios from "axios";
import { describe, expect, it } from "vitest";
import {
  UPLOAD_SESSION_EXPIRED_MESSAGE,
  UploadSessionExpiredError,
  isPayoutSetupRequiredError,
  mediaUploadErrorMessage,
} from "./api-errors";

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

describe("isPayoutSetupRequiredError", () => {
  const apiError = (data: unknown) =>
    new axios.AxiosError("bad", "ERR_BAD_REQUEST", undefined, undefined, {
      status: 400,
      data,
      statusText: "Bad Request",
      headers: {},
      config: { headers: {} } as never,
    });

  it("matches on the stable code, whatever the message says", () => {
    expect(isPayoutSetupRequiredError(apiError({ code: "payout_setup_required", detail: "Reworded copy." }))).toBe(true);
  });

  it("ignores a message that merely mentions payout setup", () => {
    expect(
      isPayoutSetupRequiredError(apiError({ code: "other_error", detail: "Complete payout setup before accepting bookings." })),
    ).toBe(false);
    expect(isPayoutSetupRequiredError(new Error("payout setup"))).toBe(false);
  });
});

describe("UploadSessionExpiredError", () => {
  it("is recognised by type and carries the sign-in copy", () => {
    const err = new UploadSessionExpiredError();
    expect(err).toBeInstanceOf(UploadSessionExpiredError);
    expect(err.message).toBe("Please sign in again, then retry your upload.");
    expect(err.message).toBe(UPLOAD_SESSION_EXPIRED_MESSAGE);
  });

  it("is shown to the user as its own copy by mediaUploadErrorMessage", () => {
    expect(mediaUploadErrorMessage(new UploadSessionExpiredError(), "photo")).toBe(
      UPLOAD_SESSION_EXPIRED_MESSAGE,
    );
  });
});
