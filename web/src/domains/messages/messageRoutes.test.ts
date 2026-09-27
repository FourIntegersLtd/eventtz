import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  contactTeamPath,
  conversationPath,
  conversationPreview,
  inboxCountLabel,
  messagesPath,
  peerProfilePath,
  quoteBookingPath,
  threadSubtitle,
} from "@/domains/messages/messageRoutes";

describe("messages paths", () => {
  it("points each portal at its own inbox", () => {
    assert.equal(messagesPath("client"), "/client/messages");
    assert.equal(messagesPath("vendor"), "/vendor/messages");
  });

  it("builds a thread link and encodes the id", () => {
    assert.equal(conversationPath("client", "conv-1"), "/client/messages/conv-1");
    assert.equal(conversationPath("vendor", "a/b"), "/vendor/messages/a%2Fb");
  });

  it("links an empty inbox to that portal's contact tab", () => {
    assert.equal(contactTeamPath("client"), "/client/help?tab=contact");
    assert.equal(contactTeamPath("vendor"), "/vendor/help?tab=contact");
  });
});

describe("peerProfilePath", () => {
  it("links a client to the vendor's browse profile", () => {
    assert.equal(peerProfilePath("client", "vendor-9", "dm"), "/client/browse/vendor-9");
  });

  it("encodes the vendor id", () => {
    assert.equal(peerProfilePath("client", "a/b", "dm"), "/client/browse/a%2Fb");
  });

  it("has no profile for a vendor's client, or for support", () => {
    assert.equal(peerProfilePath("vendor", "client-9", "dm"), null);
    assert.equal(peerProfilePath("client", "eventtz-support", "support"), null);
    assert.equal(peerProfilePath("client", "   ", "dm"), null);
  });
});

describe("quoteBookingPath", () => {
  it("opens the booking in the viewer's portal", () => {
    assert.equal(quoteBookingPath("client", "book-1"), "/client/bookings/book-1");
    assert.equal(quoteBookingPath("vendor", "book/2"), "/vendor/bookings/book%2F2");
  });
});

describe("conversationPreview", () => {
  it("counts unread messages the same way in both portals", () => {
    assert.equal(conversationPreview("client", "dm", 1), "1 unread message");
    assert.equal(conversationPreview("vendor", "support", 3), "3 unread messages");
  });

  it("labels a read support thread, then a read DM by the peer's role", () => {
    assert.equal(conversationPreview("client", "support", 0), "Eventtz Support");
    assert.equal(conversationPreview("vendor", "support", 0), "Eventtz Support");
    assert.equal(conversationPreview("client", "dm", 0), "Vendor conversation");
    assert.equal(conversationPreview("vendor", "dm", 0), "Client conversation");
  });
});

describe("threadSubtitle", () => {
  it("switches the open-thread line on support, then on portal", () => {
    assert.equal(threadSubtitle("client", "support"), "Messages with Eventtz Support");
    assert.equal(threadSubtitle("vendor", "support"), "Messages with Eventtz Support");
    assert.equal(threadSubtitle("client", "dm"), "Messages with this vendor about your event");
    assert.equal(
      threadSubtitle("vendor", "dm"),
      "Chat with this client, or send a custom quote they can accept from Bookings",
    );
  });
});

describe("inboxCountLabel", () => {
  it("singularises one conversation", () => {
    assert.equal(inboxCountLabel(1), "1 conversation");
    assert.equal(inboxCountLabel(0), "0 conversations");
    assert.equal(inboxCountLabel(2), "2 conversations");
  });
});
