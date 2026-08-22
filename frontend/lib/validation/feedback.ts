import { z } from "zod";
import { messageBodySchema } from "@/lib/validation/common";

export const feedbackSubjectSchema = z.enum([
  "feedback_bug",
  "feedback_feature",
  "feedback_general",
  "feedback_other",
]);

export const feedbackFormSchema = z.object({
  subject: feedbackSubjectSchema,
  message: messageBodySchema({ min: 10, max: 2000, label: "Message" }),
});

export type FeedbackFormInput = z.infer<typeof feedbackFormSchema>;
