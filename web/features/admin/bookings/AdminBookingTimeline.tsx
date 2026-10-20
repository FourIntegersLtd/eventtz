"use client";

import type { AdminTimelineItem } from "./adminBookingLifecycle";

type Props = {
  items: AdminTimelineItem[];
};

/** Vertical lifecycle steps (design: `ez-timeline`). */
export function AdminBookingTimeline({ items }: Props) {
  return (
    <div className="ez-timeline">
      {items.map((item) => (
        <div
          key={item.title}
          className={
            item.state === "done"
              ? "ez-tl-item ez-tl-item--done"
              : item.state === "current"
                ? "ez-tl-item ez-tl-item--current"
                : "ez-tl-item ez-tl-item--todo"
          }
        >
          <span className="ez-tl-dot" aria-hidden />
          <div className="ez-tl-body">
            <span className="ez-tl-title">{item.title}</span>
            {item.caption ? <span className="ez-caption">{item.caption}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
