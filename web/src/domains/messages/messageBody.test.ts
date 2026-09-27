import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isHtmlMessage, quoteCardFromMetadata, splitMessageLinks } from "@/domains/messages/messageBody";

describe("isHtmlMessage", () => {
  it("is true only when format is html", () => {
    assert.equal(isHtmlMessage({ format: "html" }), true);
    assert.equal(isHtmlMessage({ kind: "quote" }), false);
    assert.equal(isHtmlMessage(null), false);
    assert.equal(isHtmlMessage(undefined), false);
  });
});

describe("quoteCardFromMetadata", () => {
  it("reads a quote card", () => {
    assert.deepEqual(
      quoteCardFromMetadata({
        kind: "quote",
        booking_request_id: "book-1",
        event_name: "Summer party",
        total_label: "£400",
      }),
      { bookingRequestId: "book-1", eventName: "Summer party", totalLabel: "£400" },
    );
  });

  it("returns null without a quote kind or a booking id", () => {
    assert.equal(quoteCardFromMetadata({ kind: "admin", format: "html" }), null);
    assert.equal(
      quoteCardFromMetadata({ kind: "quote", event_name: "Summer party", total_label: "£400" }),
      null,
    );
    assert.equal(quoteCardFromMetadata(null), null);
  });
});

describe("splitMessageLinks", () => {
  it("keeps surrounding text and the url in order", () => {
    assert.deepEqual(splitMessageLinks("See https://eventtz.co.uk/help please"), [
      { kind: "text", value: "See " },
      { kind: "url", value: "https://eventtz.co.uk/help" },
      { kind: "text", value: " please" },
    ]);
  });

  it("returns one text segment when there is no url", () => {
    assert.deepEqual(splitMessageLinks("No link here"), [{ kind: "text", value: "No link here" }]);
  });

  it("returns nothing for an empty body", () => {
    assert.deepEqual(splitMessageLinks(""), []);
  });
});
