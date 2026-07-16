import { z } from "zod";
import {
  EVENT_DATE_PAST_ERROR,
  EVENT_END_DATE_PAST_ERROR,
  normalizeIsoDate,
  todayIsoDate,
} from "@/lib/eventDateValidation";

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Enter your email.")
  .email("Enter a valid email address.");

/** Sign-in / register password (matches backend min length). */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters.");

export const accountTypeSchema = z.enum(["client", "vendor"]);

export const preferredNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a preferred name.")
  .max(80, "Preferred name is too long.");

export const phoneOptionalSchema = z
  .string()
  .trim()
  .max(40, "Phone number is too long.")
  .transform((v) => (v.length > 0 ? v : null));

export const isoDateSchema = z
  .string()
  .trim()
  .refine((v) => normalizeIsoDate(v) != null, "Choose a valid date.")
  .transform((v) => normalizeIsoDate(v)!);

export function eventDatesSchema(opts?: { requireStart?: boolean }) {
  const requireStart = opts?.requireStart ?? true;
  return z
    .object({
      eventDate: requireStart
        ? z.string().trim().min(1, "Choose an event date.")
        : z.string().trim(),
      eventEndDate: z.string().trim().optional().nullable(),
    })
    .superRefine((val, ctx) => {
      const start = normalizeIsoDate(val.eventDate);
      if (!start) {
        if (requireStart || val.eventDate.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["eventDate"],
            message: "Choose a valid event date.",
          });
        }
        return;
      }
      const today = todayIsoDate();
      if (start < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventDate"],
          message: EVENT_DATE_PAST_ERROR,
        });
      }
      const endRaw = (val.eventEndDate ?? "").trim();
      if (!endRaw) return;
      const end = normalizeIsoDate(endRaw);
      if (!end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventEndDate"],
          message: "Choose a valid end date.",
        });
        return;
      }
      if (end < today) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventEndDate"],
          message: EVENT_END_DATE_PAST_ERROR,
        });
      }
      if (end < start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["eventEndDate"],
          message: "End date must be on or after the event date.",
        });
      }
    });
}

/** Money as typed by users (£1,200.50 or 1200). Returns a number when valid. */
export const moneyGbpSchema = z
  .string()
  .trim()
  .min(1, "Enter an amount.")
  .transform((raw, ctx) => {
    const cleaned = raw.replace(/£/g, "").replace(/,/g, "").trim();
    const n = Number(cleaned);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid amount in pounds (£)." });
      return z.NEVER;
    }
    return n;
  })
  .pipe(z.number().min(0, "Amount can't be negative.").max(1_000_000, "That amount is too high."));

export const messageBodySchema = (opts: { min?: number; max?: number; label?: string }) => {
  const min = opts.min ?? 1;
  const max = opts.max ?? 5000;
  const label = opts.label ?? "Message";
  return z
    .string()
    .trim()
    .min(min, min <= 1 ? `${label} cannot be empty.` : `Please enter at least ${min} characters.`)
    .max(max, `${label} is too long.`);
};

export const venueAddressSchema = z
  .string()
  .trim()
  .min(3, "Enter a full event address.")
  .max(500, "Address is too long.");
