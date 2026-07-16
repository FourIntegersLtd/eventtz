import { z } from "zod";
import { messageBodySchema } from "@/lib/validation/common";

export const contactSubjectSchema = z.enum([
  "general",
  "account",
  "booking_problem",
  "payments",
  "other",
]);

const BOOKING_SUBJECTS = new Set(["booking_problem", "payments"]);

export const contactFormSchema = z
  .object({
    subject: contactSubjectSchema,
    message: messageBodySchema({ min: 10, max: 5000, label: "Message" }),
    bookingId: z.string().trim().optional().default(""),
  })
  .superRefine((val, ctx) => {
    if (BOOKING_SUBJECTS.has(val.subject) && !val.bookingId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookingId"],
        message: "Please enter your booking reference.",
      });
    }
  });

export type ContactFormInput = z.infer<typeof contactFormSchema>;
