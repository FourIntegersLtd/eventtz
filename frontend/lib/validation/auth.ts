import { z } from "zod";
import { accountTypeSchema, adminPasswordSchema, emailSchema, passwordSchema } from "@/lib/validation/common";

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const registerSchema = z.object({
  accountType: accountTypeSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const adminInviteManualSchema = z.object({
  email: emailSchema,
  password: adminPasswordSchema,
});

export const adminInviteLinkSchema = z.object({
  email: emailSchema,
});

export const adminResetPasswordSchema = z
  .object({
    password: adminPasswordSchema,
    confirmPassword: adminPasswordSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
