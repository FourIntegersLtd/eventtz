/** Max photos a client can attach to a booking review (matches backend). */
export const MAX_REVIEW_IMAGES = 5;

export function normalizeReviewImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    const url = String(item ?? "").trim();
    if (!url) continue;
    if (!(url.startsWith("https://") || url.startsWith("http://"))) continue;
    if (!out.includes(url)) out.push(url);
    if (out.length >= MAX_REVIEW_IMAGES) break;
  }
  return out;
}
