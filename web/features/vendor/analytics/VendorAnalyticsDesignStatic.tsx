"use client";

import { Eye, MessageCircle, TrendingUp, Wallet } from "lucide-react";
import { VendorEzPageHead } from "@/features/vendor/ui/VendorEzPageHead";

/** Fixture analytics for design-diff V15. */
export function VendorAnalyticsDesignStatic() {
  return (
    <div className="ez-stack ez-stack--lg">
      <VendorEzPageHead
        eyebrow="Insights"
        title="Analytics"
        description="How clients find and choose Mama Ade's Kitchen."
        actions={
          <div className="ez-seg">
            <button className="ez-seg__item" type="button">
              7 days
            </button>
            <button className="ez-seg__item ez-seg__item--active" type="button">
              30 days
            </button>
            <button className="ez-seg__item" type="button">
              90 days
            </button>
          </div>
        }
      />

      <div className="ez-grid-4">
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Eye size={16} strokeWidth={1.75} aria-hidden />
            Profile views
          </span>
          <span className="ez-kpi__value">1,284</span>
          <span className="ez-kpi__delta">18% up</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <MessageCircle size={16} strokeWidth={1.75} aria-hidden />
            Enquiries
          </span>
          <span className="ez-kpi__value">46</span>
          <span className="ez-kpi__delta">9 up</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <TrendingUp size={16} strokeWidth={1.75} aria-hidden />
            Conversion
          </span>
          <span className="ez-kpi__value">3.6%</span>
          <span className="ez-kpi__delta">0.4 pts up</span>
        </div>
        <div className="ez-kpi">
          <span className="ez-kpi__label">
            <Wallet size={16} strokeWidth={1.75} aria-hidden />
            Booked value
          </span>
          <span className="ez-kpi__value">£6,420.00</span>
          <span className="ez-kpi__delta ez-kpi__delta--down">3 down</span>
        </div>
      </div>

      <div className="ez-grid-2">
        <div className="ez-card">
          <div className="ez-card__head">
            <span className="ez-h3">Views and enquiries by week</span>
          </div>
          <div className="ez-card__body">
            <div className="ez-bar-chart">
              {[
                ["280", 118, "Wk 1"],
                ["340", 144, "Wk 2"],
                ["310", 131, "Wk 3"],
                ["354", 150, "Wk 4"],
              ].map(([value, height, label]) => (
                <div className="ez-bar-chart__col" key={label}>
                  <span className="ez-caption">{value}</span>
                  <div className="ez-bar" style={{ height: `${height}px` }} />
                  <span className="ez-caption">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="ez-card">
          <div className="ez-card__head">
            <span className="ez-h3">Where clients come from</span>
          </div>
          <div className="ez-card__body">
            <div className="ez-lines">
              <div className="ez-lines__row">
                <span>Eventtz search</span>
                <span>612 views</span>
              </div>
              <div className="ez-lines__row">
                <span>Category browse</span>
                <span>388 views</span>
              </div>
              <div className="ez-lines__row">
                <span>Planner suggestions</span>
                <span>174 views</span>
              </div>
              <div className="ez-lines__row">
                <span>Your shared link</span>
                <span>110 views</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="ez-grid-2">
        <div className="ez-card">
          <div className="ez-card__head">
            <span className="ez-h3">Enquiry funnel</span>
          </div>
          <div className="ez-card__body">
            <div className="ez-lines">
              <div className="ez-lines__row">
                <span>Enquiries received</span>
                <span>46</span>
              </div>
              <div className="ez-lines__row">
                <span>You replied</span>
                <span>44</span>
              </div>
              <div className="ez-lines__row">
                <span>Quotes accepted</span>
                <span>14</span>
              </div>
              <div className="ez-lines__row">
                <span>Paid bookings</span>
                <span>9</span>
              </div>
              <div className="ez-lines__total">
                <span>Enquiry to booking</span>
                <span>19.6%</span>
              </div>
            </div>
          </div>
        </div>
        <div className="ez-card">
          <div className="ez-card__head">
            <span className="ez-h3">Top packages</span>
          </div>
          <div className="ez-card__body">
            <div className="ez-table-wrap">
              <table className="ez-table">
                <thead>
                  <tr>
                    <th>Package</th>
                    <th className="ez-td-num">Enquiries</th>
                    <th className="ez-td-num">Booked</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="ez-td-strong">Classic jollof buffet</td>
                    <td className="ez-td-num">31</td>
                    <td className="ez-td-num">6</td>
                  </tr>
                  <tr>
                    <td className="ez-td-strong">Naming ceremony platter</td>
                    <td className="ez-td-num">15</td>
                    <td className="ez-td-num">3</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
