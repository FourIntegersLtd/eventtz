import { z } from "zod";
import {
  eventDatesSchema,
  messageBodySchema,
  moneyGbpSchema,
  venueAddressSchema,
} from "@/lib/validation/common";

export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Tap a star to rate your experience.").max(5),
  body: messageBodySchema({ min: 10, max: 4000, label: "Review" }),
});

export const disputeSummarySchema = z.object({
  summary: messageBodySchema({ min: 10, max: 4000, label: "Summary" }),
});

export const chatMessageSchema = z.object({
  body: messageBodySchema({ min: 1, max: 5000, label: "Message" }),
});

export const clientBookingRequestSchema = z
  .object({
    eventName: z.string().trim().min(1, "Enter an event name.").max(500),
    notes: z.string().trim().max(4000).optional().default(""),
    venueAddress: z.string().trim().max(500).optional().default(""),
    selectedOptionIds: z.array(z.string()).min(1, "Choose at least one package."),
  })
  .and(eventDatesSchema({ requireStart: true }));

export const vendorQuoteSchema = z
  .object({
    eventName: z.string().trim().min(1, "Enter an event name.").max(500),
    heading: z.string().trim().min(1, "Enter a package name for this quote.").max(200),
    price: moneyGbpSchema,
    notes: z.string().trim().max(4000).optional().default(""),
    selectedPackageId: z.string().optional(),
  })
  .and(eventDatesSchema({ requireStart: true }));

export const payVenueSchema = z.object({
  eventAddress: venueAddressSchema,
});

export const vendorPriceAdjustRowSchema = z
  .object({
    kind: z.enum(["cost", "discount"]),
    amount: moneyGbpSchema.refine((n) => n > 0, "Enter an amount greater than zero."),
    reason: z.string().trim().max(200).optional().default(""),
  })
  .superRefine((val, ctx) => {
    if (val.kind === "cost" && !val.reason.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["reason"],
        message: "Explain what this extra cost is for.",
      });
    }
  });

export const vendorPriceAdjustmentsSchema = z
  .object({
    rows: z.array(vendorPriceAdjustRowSchema).min(1, "Add at least one price change."),
  });
