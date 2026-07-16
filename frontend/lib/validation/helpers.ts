import type { ZodError, ZodType, ZodTypeDef } from "zod";

/** First message per field path (dot-joined). `_form` for issues with no path. */
export function fieldErrorsFromZod(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join(".") : "_form";
    if (!out[key]) {
      out[key] = issue.message;
    }
  }
  return out;
}

export type ParseFormOk<T> = { ok: true; data: T };
export type ParseFormFail = {
  ok: false;
  fieldErrors: Record<string, string>;
  /** First error — useful for a single banner when the UI has one error slot. */
  formError: string;
};

export function parseForm<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  data: unknown,
): ParseFormOk<T> | ParseFormFail {
  const result = schema.safeParse(data);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  const fieldErrors = fieldErrorsFromZod(result.error);
  const formError =
    fieldErrors._form ??
    Object.values(fieldErrors)[0] ??
    "Please check the form and try again.";
  return { ok: false, fieldErrors, formError };
}
