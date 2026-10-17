"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DateInput } from "@/components/ui/DateInput";
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

type BookingDateChangeCardProps = {
  role: DateChangeRole;
  bookingId: string;
  bookingStatus: string;
  paymentStatus: string;
  eventDate: string;
  eventEndDate: string | null;
  dateChange: BookingDateChangeFields;
};

function formatDay(iso: string): string {
  const parsed = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
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
}: BookingDateChangeCardProps) {
  const { showToast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [newDate, setNewDate] = useState(todayIsoDate());
  const [newEndDate, setNewEndDate] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<null | "request" | "accept" | "decline" | "withdraw">(null);

  const pendingBy = dateChange.date_change_requested_by ?? null;
  const proposed = dateChange.proposed_event_date ?? null;
  const canChange =
    bookingStatus === "accepted" && (paymentStatus === "unpaid" || paymentStatus === "paid");
  if (!canChange && !pendingBy) return null;

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
    return (
      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 px-5 py-4">
        <p className="text-[15px] font-semibold tracking-tight text-neutral-900">
          {byMe
            ? `You asked to move the event to ${formatRange(proposed, dateChange.proposed_event_end_date)}`
            : `${otherLabel} asked to move the event to ${formatRange(proposed, dateChange.proposed_event_end_date)}`}
        </p>
        <p className="mt-1 text-[13px] text-neutral-600">
          Currently {formatRange(eventDate, eventEndDate)}. The price and your payment stay the same.
        </p>
        {dateChange.date_change_note ? (
          <p className="mt-2 text-[13px] text-neutral-700">&ldquo;{dateChange.date_change_note}&rdquo;</p>
        ) : null}
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
                  void run(
                    "decline",
                    () => respondToDateChange(role, bookingId, false),
                    "Date change declined",
                  )
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
    <div className="rounded-2xl border border-neutral-100 bg-neutral-50 px-5 py-4">
      <p className="text-sm font-semibold text-neutral-900">Request a date change</p>
      <p className="mt-1 text-[13px] text-neutral-600">
        The other side has to agree. Your price and payment stay the same.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-1.5">
          <span className="block text-sm font-medium text-neutral-800">New date</span>
          <DateInput value={newDate} min={todayIsoDate()} onChange={(event) => setNewDate(event.target.value)} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <span className="block text-sm font-medium text-neutral-800">New end date (optional)</span>
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
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          loading={busy === "request"}
          disabled={busy !== null || !newDate}
          onClick={() =>
            void run(
              "request",
              () =>
                requestDateChange(role, bookingId, {
                  new_event_date: newDate,
                  new_event_end_date: newEndDate || null,
                  note: note.trim() || null,
                }),
              "Date change requested",
            )
          }
        >
          Send request
        </Button>
        <Button variant="secondary" size="sm" disabled={busy !== null} onClick={() => setFormOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
