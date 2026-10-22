import axios, { type AxiosError } from "axios";
import { describe, expect, it } from "vitest";
import { classifyLoginFailure } from "@/features/auth/loginFailure";
import { SESSION_VERIFY_FAILED, SessionVerifyError } from "@/lib/auth-messages";

function apiError(body: { code?: string; detail: string }): AxiosError {
  return new axios.AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status: 403,
    data: body,
    statusText: "Forbidden",
    headers: {},
    config: { headers: {} } as never,
  });
}

describe("classifyLoginFailure", () => {
  it("asks for verification on the email_not_verified code, whatever the copy says", () => {
    const failure = classifyLoginFailure(apiError({ code: "email_not_verified", detail: "Reworded copy." }));
    expect(failure).toEqual({ message: "Reworded copy.", needsVerification: true, reason: "credentials" });
  });

  it("does not ask for verification on matching wording with another code", () => {
    const failure = classifyLoginFailure(
      apiError({ code: "wrong_credentials", detail: "Verify your email before signing in." }),
    );
    expect(failure.needsVerification).toBe(false);
  });

  it("reports session_verify for the typed client-side error, not by message equality", () => {
    expect(classifyLoginFailure(new SessionVerifyError())).toEqual({
      message: SESSION_VERIFY_FAILED,
      needsVerification: false,
      reason: "session_verify",
    });
    expect(classifyLoginFailure(new Error(SESSION_VERIFY_FAILED)).reason).toBe("credentials");
  });

  it("falls back to the generic copy", () => {
    expect(classifyLoginFailure("boom").message).toBe("Something went wrong. Please try again.");
  });
});
