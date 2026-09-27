/**
 * Client booking-request form checks.
 * Messages match the baseline Zod schema. A date is judged against a passed-in
 * "today" so tests do not depend on the clock. Prices are not validated here
 * because the request does not carry them.
 */
import { z } from "zod";
import { isoDatesInEventRange, vendorPayloadAllowsEventDates } from "./vendorAvailability";

export const CLIENT_BOOKING_NOTES_MAX_LENGTH = 4000;

export const CALENDAR_CONFLICT_MESSAGE =
  "These dates don't match this vendor's availability. Adjust the dates or message them to confirm.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local calendar date as `YYYY-MM-DD`. */
export function todayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** `YYYY-MM-DD` or null when the text is not that shape. */
export function normalizeIsoDate(raw: string): string | null {
  const head = raw.trim().slice(0, 10);
  if (!ISO_DATE.test(head)) return null;
  return head;
}

/** True when `iso` is a real calendar date strictly before `today`. */
export function isPastIsoDate(iso: string, today: string = todayIsoDate()): boolean {
  const normalized = normalizeIsoDate(iso);
  if (!normalized) return false;
  return normalized < today;
}

/**
 * True when the chosen range hits a blocked day or a weekday the vendor
 * does not work. An empty range is not a conflict (the date field reports that).
 */
export function eventDatesConflictWithVendor(
  vendorPayload: Record<string, unknown> | null | undefined,
  eventDate: string,
  eventEndDate: string,
): boolean {
  if (!vendorPayload || !eventDate.trim()) return false;
  const end = eventEndDate.trim() || null;
  const range = isoDatesInEventRange(eventDate.trim(), end);
  if (range.length === 0) return false;
  return !vendorPayloadAllowsEventDates(vendorPayload, range);
}

export type ClientBookingEnquiryFields = {
  eventName: string;
  eventDate: string;
  eventEndDate: string;
  venueAddress: string;
  notes: string;
  selectedOptionIds: string[];
  quantities?: Record<string, number>;
};

/** Fields after Zod succeeds. Still no prices. */
export type ValidatedBookingEnquiry = {
  eventName: string;
  eventDate: string;
  eventEndDate: string | null;
  venueAddress: string;
  notes: string;
  selectedOptionIds: string[];
  quantities?: Record<string, number>;
};

export type BookingEnquiryValidation =
  | { ok: true; data: ValidatedBookingEnquiry }
  | { ok: false; error: string };

function clientBookingRequestSchema(today: string) {
  return z
    .object({
      eventName: z.string().trim().min(1, "Enter an event name.").max(500),
      notes: z.string().trim().max(CLIENT_BOOKING_NOTES_MAX_LENGTH).optional().default(""),
      venueAddress: z.string().trim().max(500).optional().default(""),
      selectedOptionIds: z.array(z.string()).min(1, "Choose at least one package."),
      quantities: z.record(z.number().int().min(1).max(100_000)).optional(),
      eventDate: z.string().trim().min(1, "Choose an event date."),
      eventEndDate: z.string().trim().optional().nullable(),
    })
    .superRefine((value, context) => {
      const start = normalizeIsoDate(value.eventDate);
      if (!start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventDate"],
          message: "Choose a valid event date.",
        });
        return;
      }
      if (start < today) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventDate"],
          message: "Event date cannot be in the past.",
        });
      }
      const endRaw = (value.eventEndDate ?? "").trim();
      if (!endRaw) return;
      const end = normalizeIsoDate(endRaw);
      if (!end) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventEndDate"],
          message: "Choose a valid end date.",
        });
        return;
      }
      if (end < today) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventEndDate"],
          message: "End date cannot be in the past.",
        });
      }
      if (end < start) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventEndDate"],
          message: "End date must be on or after the event date.",
        });
      }
    });
}

function firstZodMessage(error: z.ZodError): string {
  const first = error.issues[0];
  return first?.message ?? "Please check the form and try again.";
}

/**
 * Calendar conflict first, then the Zod schema.
 * `today` defaults to the local date. Tests pass a fixed day.
 */
export function validateClientBookingEnquiry(
  fields: ClientBookingEnquiryFields,
  calendarConflict: boolean,
  today: string = todayIsoDate(),
): BookingEnquiryValidation {
  if (calendarConflict) {
    return { ok: false, error: CALENDAR_CONFLICT_MESSAGE };
  }
  const parsed = clientBookingRequestSchema(today).safeParse({
    eventName: fields.eventName,
    eventDate: fields.eventDate,
    eventEndDate: fields.eventEndDate || null,
    venueAddress: fields.venueAddress,
    notes: fields.notes,
    selectedOptionIds: fields.selectedOptionIds,
    quantities: fields.quantities,
  });
  if (!parsed.success) {
    return { ok: false, error: firstZodMessage(parsed.error) };
  }
  const endRaw = (parsed.data.eventEndDate ?? "").trim();
  return {
    ok: true,
    data: {
      eventName: parsed.data.eventName,
      eventDate: normalizeIsoDate(parsed.data.eventDate) ?? parsed.data.eventDate,
      eventEndDate: endRaw ? normalizeIsoDate(endRaw) : null,
      venueAddress: parsed.data.venueAddress,
      notes: parsed.data.notes,
      selectedOptionIds: parsed.data.selectedOptionIds,
      quantities: parsed.data.quantities,
    },
  };
}
