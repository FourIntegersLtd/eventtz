import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PlatformError } from "@/foundation/platform-client/errors";
import {
  CONTACT_MESSAGE_REQUIRED,
  CONTACT_SEND_FAILED,
  buildContactRequestBody,
  contactErrorMessage,
  validateContactMessage,
} from "@/domains/client-contact/contactForm";

describe("validateContactMessage", () => {
  it("rejects an empty message", () => {
    assert.equal(validateContactMessage(""), CONTACT_MESSAGE_REQUIRED);
  });

  it("rejects a message that is only whitespace", () => {
    assert.equal(validateContactMessage("  \n\t "), CONTACT_MESSAGE_REQUIRED);
  });

  it("accepts a message with any visible character", () => {
    assert.equal(validateContactMessage("?"), null);
  });
});

describe("buildContactRequestBody", () => {
  it("trims the message and sends a blank booking reference as null", () => {
    assert.deepEqual(buildContactRequestBody("  Can you help with catering?  ", ""), {
      message: "Can you help with catering?",
      booking_id: null,
    });
  });

  it("treats a whitespace-only booking reference as no booking", () => {
    assert.deepEqual(buildContactRequestBody("Hi", "   "), { message: "Hi", booking_id: null });
  });

  it("keeps a booking reference, trimmed", () => {
    assert.deepEqual(buildContactRequestBody("Hi", "  b1f2c3d4-0000-4000-8000-000000000000  "), {
      message: "Hi",
      booking_id: "b1f2c3d4-0000-4000-8000-000000000000",
    });
  });
});

describe("contactErrorMessage", () => {
  it("shows the contact copy for each code the endpoint can return", () => {
    const expected: readonly [string, string][] = [
      ["contact_message_too_short", "Please enter at least 10 characters."],
      ["contact_invalid_booking_reference", "That booking reference doesn't look right."],
      ["contact_booking_not_found", "Booking not found."],
      ["contact_booking_not_on_account", "That booking is not on your account."],
    ];

    for (const [code, message] of expected) {
      assert.equal(contactErrorMessage(new PlatformError(400, { detail: "server text", code })), message);
    }
  });

  it("falls back to the API's detail for any other platform code", () => {
    const error = new PlatformError(429, { detail: "Too many requests. Try again later.", code: "rate_limited" });

    assert.equal(contactErrorMessage(error), "Too many requests. Try again later.");
  });

  it("uses our own copy when the request never reached the API", () => {
    assert.equal(contactErrorMessage(new Error("fetch failed")), CONTACT_SEND_FAILED);
  });

  it("uses our own copy for a thrown non-error value", () => {
    assert.equal(contactErrorMessage("boom"), CONTACT_SEND_FAILED);
  });
});
