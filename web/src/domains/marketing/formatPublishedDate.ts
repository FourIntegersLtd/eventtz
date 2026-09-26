/** UK-formatted publish date, or an empty string for a missing/invalid one. Matches the baseline's blog date format. */
export function formatPublishedDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
