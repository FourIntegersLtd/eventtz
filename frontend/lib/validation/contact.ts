import { z } from "zod";
import { messageBodySchema } from "@/lib/validation/common";

export const contactFormSchema = z.object({
  message: messageBodySchema({ min: 10, max: 5000, label: "Message" }),
  bookingId: z.string().trim().optional().default(""),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

export const adminBugReportSchema = z.object({
  message: messageBodySchema({ min: 10, max: 5000, label: "Message" }),
});

export type AdminBugReportInput = z.infer<typeof adminBugReportSchema>;
