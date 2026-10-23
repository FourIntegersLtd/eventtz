import { formatDate } from "@/lib/dateFormat";

export type AdminTimelineItem = {
  title: string;
  caption: string;
  state: "done" | "current" | "todo";
};

function readTs(booking: Record<string, unknown>, key: string): unknown {
  return booking[key];
}

function formatCaption(value: unknown): string {
  if (value == null) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDate(date, "dateTimeMedium");
}

/** Request lifecycle timeline from booking timestamps and status. */
export function buildRequestLifecycleTimeline(
  booking: Record<string, unknown>,
): AdminTimelineItem[] {
  const status = String(booking.status ?? "").toLowerCase();
  const created = readTs(booking, "created_at");
  const quoteSent =
    readTs(booking, "quote_sent_at") ??
    readTs(booking, "vendor_quoted_at") ??
    readTs(booking, "quoted_at");
  const accepted =
    readTs(booking, "accepted_at") ??
    readTs(booking, "client_accepted_at") ??
    readTs(booking, "paid_at");
  const eventDate = booking.event_date != null ? String(booking.event_date) : "";
  const completed =
    readTs(booking, "completed_at") ??
    (status === "completed" ? readTs(booking, "vendor_completion_confirmed_at") : null);

  const confirmed =
    status === "accepted" ||
    status === "confirmed" ||
    status === "completed" ||
    Boolean(readTs(booking, "paid_at"));

  const items: AdminTimelineItem[] = [
    {
      title: "Enquiry sent",
      caption: formatCaption(created),
      state: created ? "done" : "todo",
    },
    {
      title: "Quote sent by vendor",
      caption: formatCaption(quoteSent),
      state: quoteSent ? "done" : confirmed || status === "completed" ? "done" : "todo",
    },
    {
      title: "Quote accepted by client",
      caption: formatCaption(accepted),
      state: accepted ? "done" : confirmed ? "done" : "todo",
    },
    {
      title: eventDate
        ? `Confirmed, event ${eventDate}`
        : confirmed
          ? "Confirmed"
          : "Event",
      caption: confirmed && !completed ? "Awaiting event" : "",
      state: completed ? "done" : confirmed ? "current" : "todo",
    },
    {
      title: "Completed",
      caption: formatCaption(completed),
      state: completed || status === "completed" ? "done" : "todo",
    },
  ];

  return normalizeTimelineStates(items);
}

/** Payment lifecycle timeline from payment fields. */
export function buildPaymentLifecycleTimeline(
  booking: Record<string, unknown>,
): AdminTimelineItem[] {
  const paymentStatus = String(booking.payment_status ?? "unpaid").toLowerCase();
  const paidAt = readTs(booking, "paid_at");
  const payoutAt = readTs(booking, "payout_released_at");
  const paid =
    Boolean(paidAt) ||
    paymentStatus === "paid" ||
    paymentStatus === "payout_released" ||
    paymentStatus === "partially_refunded";

  const payoutDone = Boolean(payoutAt) || paymentStatus === "payout_released";
  const held = paid && !payoutDone && paymentStatus !== "refunded";

  const items: AdminTimelineItem[] = [
    {
      title: "Checkout paid to Eventtz",
      caption: formatCaption(paidAt),
      state: paid ? "done" : "todo",
    },
    {
      title: "Funds held",
      caption: held ? "Release after event, no dispute" : payoutDone ? "Released" : "",
      state: payoutDone ? "done" : held ? "current" : paid ? "current" : "todo",
    },
    {
      title: "Payout to vendor",
      caption: payoutDone ? formatCaption(payoutAt) : "Not yet due",
      state: payoutDone ? "done" : "todo",
    },
  ];

  return normalizeTimelineStates(items);
}

function normalizeTimelineStates(items: AdminTimelineItem[]): AdminTimelineItem[] {
  let seenCurrent = false;
  return items.map((item) => {
    if (item.state === "current") {
      if (seenCurrent) return { ...item, state: "todo" as const };
      seenCurrent = true;
    }
    return item;
  });
}
