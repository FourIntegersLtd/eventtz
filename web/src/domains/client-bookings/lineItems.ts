/**
 * `ClientBookingDetail.line_items` is generated as `Record<string, unknown>[]`
 * — the API describes it as a free-form JSON blob rather than a typed schema
 * (see `schema.d.ts`). This narrows one entry down to the fields the detail
 * screen actually shows, without an `any` (banned by eslint) and without
 * trusting a field that turns out to be the wrong type.
 */
export interface DisplayLineItem {
  id: string;
  heading: string;
  quantity: number | null;
  unitLabel: string | null;
  unitPriceGbp: number | null;
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" ? value : null;
}

/** Reads one raw `line_items` entry into a shape safe to render. */
export function toDisplayLineItem(raw: Record<string, unknown>, index: number): DisplayLineItem {
  return {
    id: readString(raw, "id") ?? `line-${index}`,
    heading: readString(raw, "heading") ?? "Item",
    quantity: readNumber(raw, "quantity"),
    unitLabel: readString(raw, "unit_label"),
    unitPriceGbp: readNumber(raw, "unit_price_gbp") ?? readNumber(raw, "unit_rate_gbp"),
  };
}
