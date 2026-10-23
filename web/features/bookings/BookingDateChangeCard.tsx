"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { useToast } from "@/components/ui/Toast";
import { getApiErrorCode, getApiErrorDetail } from "@/lib/api-errors";
import {
  DATE_CHANGE_ERROR_COPY,
  requestDateChange,
  respondToDateChange,
  withdrawDateChange,
  type BookingDateChangeFields,
  type DateChangeRole,
} from "@/lib/bookingDateChangeApi";
import { realtimeBus } from "@/lib/realtimeBus";
import { todayIsoDate } from "@/lib/eventDateValidation";
import { formatDate } from "@/lib/dateFormat";

type BookingDateChangeCardProps = {
  role: DateChangeRole;
  bookingId: string;
  bookingStatus: string;
  paymentStatus: string;
  eventDate: string;
  eventEndDate: string | null;
  dateChange: BookingDateChangeFields;
  /** `modal` keeps a button in place and opens the request form over the page. */
  requestPresentation?: "inline" | "modal";
};

/** True when a date can be requested, or a request is already waiting for an answer. */
export function dateChangeIsVisible(
  bookingStatus: string,
  paymentStatus: string,
  requestedBy: string | null | undefined,
): boolean {
  const canChange =
    bookingStatus === "accepted" && (paymentStatus === "unpaid" || paymentStatus === "paid");
  return canChange || Boolean(requestedBy);
}

function formatDay(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return formatDate(parsed, "dayLongMonthYear");
}

function formatRange(startIso: string, endIso: string | null | undefined): string {
  if (!endIso || endIso.slice(0, 10) === startIso.slice(0, 10)) return formatDay(startIso);
  return `${formatDay(startIso)} to ${formatDay(endIso)}`;
}

/**
 * Rescheduling on an accepted booking: ask to move the date, answer the other side's
 * request, or take your own back. Price, policy and payment never change.
 */
export function BookingDateChangeCard({
  role,
  bookingId,
  bookingStatus,
  paymentStatus,
  eventDate,
  eventEndDate,
  dateChange,
  requestPresentation = "inline",
}: BookingDateChangeCardProps) {
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayIsoDate());
  const [newEndDate, setNewEndDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "request" | "accept" | "decline" | "withdraw">(null);

  const pendingBy = dateChange.date_change_requested_by ?? null;
  const proposed = dateChange.proposed_event_date ?? null;
  if (!dateChangeIsVisible(bookingStatus, paymentStatus, pendingBy)) return null;

  const otherLabel = role === "client" ? "Your vendor" : "Your client";

  async function run(
    action: NonNullable<typeof busy>,
    call: () => Promise<void>,
    successTitle: string,
  ) {
    setBusy(action);
    try {
      await call();
      showToast({ title: successTitle, tone: "success" });
      setFormOpen(false);
      setNote("");
      realtimeBus.emit("bookings:refresh");
    } catch (error: unknown) {
      const code = getApiErrorCode(error);
      showToast({
        title: "Could not update the date",
        description:
          (code && DATE_CHANGE_ERROR_COPY[code]) ?? getApiErrorDetail(error) ?? "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  if (pendingBy && proposed) {
    const byMe = pendingBy === role;
    const headline = byMe
      ? `You asked to move the event to ${formatRange(proposed, dateChange.proposed_event_end_date)}`
      : `${otherLabel} asked to move the event to ${formatRange(proposed, dateChange.proposed_event_end_date)}`;
    const detail = `Currently ${formatRange(eventDate, eventEndDate)}. The price and your payment stay the same.`;
    const note = dateChange.date_change_note ? (
      <p className="text-[13px] text-ink-2">&ldquo;{dateChange.date_change_note}&rdquo;</p>
    ) : null;

    if (requestPresentation === "modal") {
      return (
        <div className="ez-stack ez-stack--sm">
          <p className="text-sm font-semibold text-ink">{headline}</p>
          <p className="text-[13px] text-ink-2">{detail}</p>
          {note}
          {byMe ? (
            <Button
              type="button"
              variant="secondary" className="ez-btn--block"
              disabled={busy !== null}
              onClick={() =>
                void run("withdraw", () => withdrawDateChange(role, bookingId), "Request withdrawn")
              }
            >
              {busy === "withdraw" ? "Withdrawing…" : "Withdraw request"}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                className="ez-btn--block"
                disabled={busy !== null}
                onClick={() =>
                  void run("accept", () => respondToDateChange(role, bookingId, true), "New date agreed")
                }
              >
                {busy === "accept" ? "Accepting…" : "Accept new date"}
              </Button>
              <Button
                type="button"
                variant="secondary" className="ez-btn--block"
                disabled={busy !== null}
                onClick={() =>
                  void run("decline", () => respondToDateChange(role, bookingId, false), "Date change declined")
                }
              >
                {busy === "decline" ? "Declining…" : "Decline"}
              </Button>
            </>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 px-5 py-4">
        <p className="text-[15px] font-semibold tracking-tight text-ink">{headline}</p>
        <p className="mt-1 text-[13px] text-ink-2">{detail}</p>
        {note ? <div className="mt-2">{note}</div> : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {byMe ? (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "withdraw"}
              disabled={busy !== null}
              onClick={() =>
                void run("withdraw", () => withdrawDateChange(role, bookingId), "Request withdrawn")
              }
            >
              Withdraw request
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                loading={busy === "accept"}
                disabled={busy !== null}
                onClick={() =>
                  void run("accept", () => respondToDateChange(role, bookingId, true), "New date agreed")
                }
              >
                Accept new date
              </Button>
              <Button
                variant="secondary"
                size="sm"
                loading={busy === "decline"}
                disabled={busy !== null}
                onClick={() =>
                  void run("decline", () => respondToDateChange(role, bookingId, false), "Date change declined")
                }
              >
                Decline
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  const requestForm = (
    <>
      <p className="text-[13px] text-ink-2">
        The other side has to agree. Your price and payment stay the same.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <span className="block text-sm font-medium text-ink">New date</span>
          <DateInput value={newDate} min={todayIsoDate()} onChange={(event) => setNewDate(event.target.value)} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <span className="block text-sm font-medium text-ink">New end date (optional)</span>
          <DateInput
            allowEmpty
            value={newEndDate}
            min={newDate}
            onChange={(event) => setNewEndDate(event.target.value)}
          />
        </div>
      </div>
      <div className="mt-3">
        <TextArea
          label="Note (optional)"
          rows={2}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
    </>
  );

  const sendRequest = () =>
    void run(
      "request",
      () =>
        requestDateChange(role, bookingId, {
          new_event_date: newDate,
          new_event_end_date: newEndDate || null,
          note: note.trim() || null,
        }),
      "Date change requested",
    );

  if (requestPresentation === "modal") {
    return (
      <>
        <Button type="button" variant="secondary" className="ez-btn--block" onClick={() => setFormOpen(true)}>
          Request a date change
        </Button>
        <Modal
          isOpen={formOpen}
          onClose={() => {
            if (busy === null) setFormOpen(false);
          }}
          title="Request a date change"
          maxWidthClassName="max-w-lg"
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" loading={busy === "request"} disabled={busy !== null || !newDate} onClick={sendRequest}>
                Send request
              </Button>
            </div>
          }
        >
          {requestForm}
        </Modal>
      </>
    );
  }

  if (!formOpen) {
    return (
      <div className="flex">
        <Button variant="secondary" size="sm" onClick={() => setFormOpen(true)}>
          Request a date change
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-3 px-5 py-4">
      <p className="text-sm font-semibold text-ink">Request a date change</p>
      {requestForm}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" loading={busy === "request"} disabled={busy !== null || !newDate} onClick={sendRequest}>
          Send request
        </Button>
        <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setFormOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
