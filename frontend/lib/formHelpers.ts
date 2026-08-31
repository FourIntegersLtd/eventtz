export function clearFieldError(
  fieldErrors: Record<string, string>,
  field: string,
): Record<string, string> {
  if (!fieldErrors[field]) return fieldErrors;
  const next = { ...fieldErrors };
  delete next[field];
  return next;
}
