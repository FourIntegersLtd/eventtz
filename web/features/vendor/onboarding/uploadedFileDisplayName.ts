/** Human-readable label for a persisted upload URL (uses stored label from upload time). */
export function uploadedFileDisplayName(
  url: string,
  labels: Record<string, string>,
  fallback = "Uploaded file",
): string {
  const trimmed = labels[url]?.trim();
  if (trimmed) return trimmed;
  return fallback;
}
