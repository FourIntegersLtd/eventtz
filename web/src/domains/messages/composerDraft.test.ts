import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clampMessageDraft, MESSAGE_MAX_LENGTH, validateMessageDraft } from "@/domains/messages/composerDraft";

describe("validateMessageDraft", () => {
  it("trims and accepts a normal message", () => {
    assert.deepEqual(validateMessageDraft("  hello  "), { ok: true, body: "hello" });
  });

  it("rejects an empty or whitespace-only draft", () => {
    assert.deepEqual(validateMessageDraft(""), { ok: false, error: "Message cannot be empty." });
    assert.deepEqual(validateMessageDraft("   \n"), { ok: false, error: "Message cannot be empty." });
  });

  it("accepts a message of exactly the max length", () => {
    const body = "a".repeat(MESSAGE_MAX_LENGTH);
    assert.deepEqual(validateMessageDraft(body), { ok: true, body });
  });

  it("rejects a message one character over the max", () => {
    assert.deepEqual(validateMessageDraft("a".repeat(MESSAGE_MAX_LENGTH + 1)), {
      ok: false,
      error: "Message is too long.",
    });
  });
});

describe("clampMessageDraft", () => {
  it("leaves a short draft unchanged", () => {
    assert.equal(clampMessageDraft("hello"), "hello");
  });

  it("slices a paste down to the max length", () => {
    assert.equal(clampMessageDraft("a".repeat(MESSAGE_MAX_LENGTH + 40)).length, MESSAGE_MAX_LENGTH);
  });
});
