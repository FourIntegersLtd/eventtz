import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIENT_NAV,
  clientHidePageTitleOnMobile,
  clientNavItems,
  clientPortalPageTitle,
  isClientNavActive,
} from "@/domains/client-shell/portalNav";

describe("clientNavItems and CLIENT_NAV", () => {
  it("lists every client portal section, label-only, in baseline order", () => {
    assert.deepEqual(
      clientNavItems().map((item) => [item.href, item.label]),
      [
        ["/client/dashboard", "Dashboard"],
        ["/client/planner", "Plan my event"],
        ["/client/browse", "Browse"],
        ["/client/favorites", "Favorites"],
        ["/client/bookings", "Bookings"],
        ["/client/help", "Help"],
        ["/client/disputes", "Disputes"],
        ["/client/settings", "Settings"],
      ],
    );
  });

  it("returns the same items as the exported constant", () => {
    assert.deepEqual(clientNavItems(), CLIENT_NAV);
  });
});

describe("isClientNavActive", () => {
  it("matches the dashboard exactly but not its prefix siblings", () => {
    assert.equal(isClientNavActive("/client/dashboard", "/client/dashboard"), true);
    assert.equal(isClientNavActive("/client/dashboard/somewhere", "/client/dashboard"), false);
  });

  it("matches a nested route under any other nav item", () => {
    assert.equal(isClientNavActive("/client/bookings/abc-123/pay", "/client/bookings"), true);
  });

  it("treats reviews as nested under settings, and distinct nav items as distinct", () => {
    assert.equal(isClientNavActive("/client/settings/reviews", "/client/settings"), true);
    assert.equal(isClientNavActive("/client/help", "/client/bookings"), false);
  });

  it("does not match unrelated routes", () => {
    assert.equal(isClientNavActive("/client/contact", "/client/help"), false);
  });
});

describe("clientPortalPageTitle", () => {
  it("resolves every nav section to its baseline title", () => {
    assert.equal(clientPortalPageTitle("/client/dashboard"), "Dashboard");
    assert.equal(clientPortalPageTitle("/client/planner"), "Plan my celebration");
    assert.equal(clientPortalPageTitle("/client/browse"), "Browse vendors");
    assert.equal(clientPortalPageTitle("/client/favorites"), "Favorites");
    assert.equal(clientPortalPageTitle("/client/bookings"), "My bookings");
    assert.equal(clientPortalPageTitle("/client/help"), "Help");
    assert.equal(clientPortalPageTitle("/client/disputes"), "Disputes");
    assert.equal(clientPortalPageTitle("/client/settings"), "Settings");
  });

  it("applies to nested detail routes of a section", () => {
    assert.equal(clientPortalPageTitle("/client/bookings/abc-123/pay"), "My bookings");
    assert.equal(clientPortalPageTitle("/client/planner/abc-123"), "Plan my celebration");
  });

  it("prefers the more specific rule when prefixes overlap", () => {
    assert.equal(clientPortalPageTitle("/client/settings/reviews"), "Your reviews");
  });

  it("titles the standalone contact page like the vendor port does", () => {
    assert.equal(clientPortalPageTitle("/client/contact"), "Contact us");
  });

  it("titles secondary routes and returns empty for unknown ones", () => {
    assert.equal(clientPortalPageTitle("/client/notifications"), "Notifications");
    assert.equal(clientPortalPageTitle("/client/payments"), "Payment history");
    assert.equal(clientPortalPageTitle("/client/nope"), "");
  });
});

describe("clientHidePageTitleOnMobile", () => {
  it("hides the title on a booking detail route", () => {
    assert.equal(clientHidePageTitleOnMobile("/client/bookings/abc-123"), true);
  });

  it("hides the title on message and help-message thread routes", () => {
    assert.equal(clientHidePageTitleOnMobile("/client/messages/abc-123"), true);
    assert.equal(clientHidePageTitleOnMobile("/client/help/messages/abc-123"), true);
  });

  it("keeps the title on section and form pages", () => {
    assert.equal(clientHidePageTitleOnMobile("/client/bookings"), false);
    assert.equal(clientHidePageTitleOnMobile("/client/contact"), false);
  });
});