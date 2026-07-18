import {
  EVENT_TYPE_IDS_ALL,
  EVENT_TYPE_OPTIONS,
  SERVICE_OPTIONS,
} from "@/features/vendor/onboarding/constants";

/** Normalize legacy / alternate stored keys to canonical option values. */
const EVENT_TYPE_ALIASES: Record<string, string> = {
  naming_ceremony: "naming_ceremonies",
};

function humanizeSlug(value: string): string {
  const s = value.replace(/_/g, " ").trim();
  if (!s) return value;
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function labelFromOptions(
  raw: string,
  options: { value: string; label: string }[],
): string | undefined {
  const key = EVENT_TYPE_ALIASES[raw] ?? raw;
  return options.find((o) => o.value === key)?.label;
}

/** User-facing labels for vendor event type values (snake_case → labels, handles `all`). */
export function displayEventTypes(raw: string[]): string[] {
  if (raw.length === 0) return [];
  if (raw.includes("all")) {
    return EVENT_TYPE_IDS_ALL.map(
      (id) =>
        EVENT_TYPE_OPTIONS.find((o) => o.value === id)?.label ?? humanizeSlug(id),
    );
  }
  return raw
    .filter((t) => t !== "all")
    .map((t) => labelFromOptions(t, EVENT_TYPE_OPTIONS) ?? humanizeSlug(t));
}

/** User-facing labels for service keys from onboarding. */
export function displayServicesOffered(raw: string[]): string[] {
  if (raw.length === 0) return [];
  return raw.map(
    (s) => labelFromOptions(s, SERVICE_OPTIONS) ?? humanizeSlug(s),
  );
}
