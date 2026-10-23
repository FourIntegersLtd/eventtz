"use client";
import { formatDate } from "@/lib/dateFormat";

function formatAxisDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso.slice(5);
  return formatDate(d, "dayMonth");
}

export { formatAxisDate };

export function chartHasData(values: number[]): boolean {
  return values.some((v) => v > 0);
}
