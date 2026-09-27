import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { helpHubPath, helpHubTabHref, parseHelpHubTab } from "@/domains/help/helpHub";

describe("helpHubPath", () => {
  it("points each portal at its own help hub", () => {
    assert.equal(helpHubPath("client"), "/client/help");
    assert.equal(helpHubPath("vendor"), "/vendor/help");
  });
});

describe("helpHubTabHref", () => {
  it("links the messages tab to the hub root, with no query param", () => {
    assert.equal(helpHubTabHref("client", "messages"), "/client/help");
    assert.equal(helpHubTabHref("vendor", "messages"), "/vendor/help");
  });

  it("links the contact tab with a ?tab= query param", () => {
    assert.equal(helpHubTabHref("client", "contact"), "/client/help?tab=contact");
    assert.equal(helpHubTabHref("vendor", "contact"), "/vendor/help?tab=contact");
  });
});

describe("parseHelpHubTab", () => {
  it("resolves 'contact' to the contact tab", () => {
    assert.equal(parseHelpHubTab("contact"), "contact");
  });

  it("resolves the 'feedback' alias to the contact tab", () => {
    assert.equal(parseHelpHubTab("feedback"), "contact");
  });

  it("falls back to messages for an unknown value", () => {
    assert.equal(parseHelpHubTab("articles"), "messages");
  });

  it("falls back to messages when the value is undefined", () => {
    assert.equal(parseHelpHubTab(undefined), "messages");
  });

  it("falls back to messages for an empty string", () => {
    assert.equal(parseHelpHubTab(""), "messages");
  });

  it("uses only the first value of an array search param", () => {
    assert.equal(parseHelpHubTab(["contact", "messages"]), "contact");
    assert.equal(parseHelpHubTab(["messages", "contact"]), "messages");
  });

  it("falls back to messages for an empty array", () => {
    assert.equal(parseHelpHubTab([]), "messages");
  });
});
