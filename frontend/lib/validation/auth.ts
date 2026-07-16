import { z } from "zod";
import { accountTypeSchema, emailSchema, passwordSchema } from "@/lib/validation/common";

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  accountType: accountTypeSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const adminInviteSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
