"use client";

import { VendorEzPageHead } from "@/features/vendor/ui/VendorEzPageHead";

type VendorBookingsDesignVariant = "index" | "payout-modal";

const INDEX_ROWS = [
  ["Amara Okafor", "Wedding reception", "Sat 14 Nov 2026", "Pending", "£1,134.00", "ez-badge--warning"],
  ["Sam Patel", "Birthday dinner", "Fri 27 Nov 2026", "Pending", "£640.00", "ez-badge--warning"],
  ["Chidi Eze", "Naming ceremony", "Sun 6 Dec 2026", "Accepted, awaiting payment", "£472.50", "ez-badge--brand"],
  ["Folake Bello", "Engagement party", "Sat 21 Nov 2026", "Quote sent", "£980.00", "ez-badge--info"],
  ["Tunde Williams", "Corporate lunch", "Thu 12 Nov 2026", "Paid", "£1,260.00", "ez-badge--success"],
  ["Funmi Adeyemi", "Anniversary lunch", "Sat 10 Oct 2026", "Completed", "£540.00", "ez-badge--success ez-badge--plain"],
  ["Ngozi Obi", "Baby shower", "Sat 3 Oct 2026", "Declined", "£360.00", "ez-badge--neutral"],
  ["Yemi Cole", "Housewarming", "Sun 27 Sep 2026", "Refunded", "£420.00", "ez-badge--info"],
] as const;

const PENDING_ROWS = [
  ["Amara Okafor", "Wedding reception", "Sat 14 Nov 2026", "Pending", "£1,250.00", "ez-badge--warning"],
  ["Sam Patel", "Birthday dinner", "Fri 27 Nov 2026", "Pending", "£640.00", "ez-badge--warning"],
  ["Chidi Eze", "Naming ceremony", "Sun 6 Dec 2026", "Quote sent", "£450.00", "ez-badge--info"],
] as const;

/** Fixture layout for design-diff (V13, V16). */
export function VendorBookingsDesignStatic({ variant }: { variant: VendorBookingsDesignVariant }) {
  const pendingOnly = variant === "payout-modal";
  const rows = pendingOnly ? PENDING_ROWS : INDEX_ROWS;

  return (
    <div className="ez-stack ez-stack--lg">
      <VendorEzPageHead
        eyebrow="Work"
        title="Bookings"
        description="Respond to enquiries and manage confirmed events."
      />

      <div className="ez-tabs" role="tablist">
        {pendingOnly ? (
          <>
            <span className="ez-tab">All</span>
            <span className="ez-tab ez-tab--active">
              Pending<span className="ez-tab__count">3</span>
            </span>
            <span className="ez-tab">Accepted</span>
            <span className="ez-tab">Confirmed</span>
            <span className="ez-tab">Completed</span>
          </>
        ) : (
          <>
            <span className="ez-tab ez-tab--active">
              All<span className="ez-tab__count">12</span>
            </span>
            <span className="ez-tab">
              Pending<span className="ez-tab__count">3</span>
            </span>
            <span className="ez-tab">
              Quote sent<span className="ez-tab__count">1</span>
            </span>
            <span className="ez-tab">
              Accepted<span className="ez-tab__count">1</span>
            </span>
            <span className="ez-tab">
              Confirmed<span className="ez-tab__count">3</span>
            </span>
            <span className="ez-tab">
              Completed<span className="ez-tab__count">3</span>
            </span>
            <span className="ez-tab">
              Cancelled<span className="ez-tab__count">1</span>
            </span>
          </>
        )}
      </div>

      {!pendingOnly ? (
        <div className="ez-hrow">
          <div className="ez-field">
            <label className="ez-label" htmlFor="vendor-bookings-design-search">
              Search
            </label>
            <input
              className="ez-input"
              id="vendor-bookings-design-search"
              type="text"
              readOnly
              placeholder="Search by client or event"
            />
          </div>
          <div style={{ flex: "none" }}>
            <div className="ez-field">
              <label className="ez-label" htmlFor="vendor-bookings-design-sort">
                Sort
              </label>
              <div className="ez-select-wrap">
                <select className="ez-input ez-select" id="vendor-bookings-design-sort" defaultValue="">
                  <option>Newest first</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="ez-table-wrap">
        <table className="ez-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Event</th>
              <th>Date</th>
              <th className="ez-td-status">Status</th>
              <th className="ez-td-num">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([client, event, date, status, total, badgeClass]) => (
              <tr key={`${client}-${event}`}>
                <td className="ez-td-strong">{client}</td>
                <td>{event}</td>
                <td>{date}</td>
                <td className="ez-td-status">
                  <span className={`ez-badge ${badgeClass}`}>{status}</span>
                </td>
                <td className="ez-td-num">{total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!pendingOnly ? <div className="ez-pagination"><span className="ez-small">Showing 1 to 8 of 12</span></div> : null}
    </div>
  );
}
