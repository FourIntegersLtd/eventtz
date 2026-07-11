"use client";

function formatAxisDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export { formatAxisDate };

export function chartHasData(values: number[]): boolean {
  return values.some((v) => v > 0);
}
