import { z } from "zod";
import { emailSchema, messageBodySchema, moneyGbpSchema, phoneOptionalSchema, preferredNameSchema } from "@/lib/validation/common";

export const preferredNameFormSchema = z.object({
  preferredName: preferredNameSchema,
});

export const contactPhoneFormSchema = z.object({
  phone: phoneOptionalSchema,
});

export const adminCancelBookingSchema = z.object({
  reason: z.string().trim().min(3, "Enter a short reason (at least 3 characters).").max(2000),
  onBehalfOf: z.enum(["client", "vendor", "admin"]).optional(),
});

export const adminPartialRefundSchema = z.object({
  amount: moneyGbpSchema.refine((n) => n > 0, "Enter a refund amount greater than zero."),
  note: z.string().trim().max(8000).optional().default(""),
});

export const adminEmailTestSchema = z.object({
  templateId: z.string().trim().min(1, "Choose a template."),
  toEmail: emailSchema,
});

export const adminComposeMessageSchema = z
  .object({
    body: messageBodySchema({ min: 1, max: 5000 }),
    audience: z.enum(["selected", "clients", "vendors", "users"]),
    recipientCount: z.number().int().nonnegative(),
  })
  .superRefine((val, ctx) => {
    if (val.audience === "selected" && val.recipientCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recipientCount"],
        message: "Choose at least one recipient.",
      });
    }
  });

export const adminBlogSaveSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(300),
  subtitle: z.string().trim().max(500).optional().nullable(),
  slug: z.string().trim().max(200).optional().nullable(),
  authorName: z.string().trim().max(120).optional().nullable(),
});

export const marketplaceBudgetSchema = z
  .object({
    min: z.string().trim().optional().default(""),
    max: z.string().trim().optional().default(""),
  })
  .superRefine((val, ctx) => {
    const parse = (raw: string, path: string) => {
      if (!raw) return null;
      const n = Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [path],
          message: "Enter a valid budget amount.",
        });
        return null;
      }
      return n;
    };
    const min = parse(val.min ?? "", "min");
    const max = parse(val.max ?? "", "max");
    if (min != null && max != null && min > max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["max"],
        message: "Max budget must be at least the min.",
      });
    }
  });
