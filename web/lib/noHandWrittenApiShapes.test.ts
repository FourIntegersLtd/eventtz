/**
 * ADR 0007: the generated `lib/api-schema.d.ts` is the source of truth for API shapes. This fails
 * when a `lib/*Api.ts` client declares an object type (`type X = {` or `interface X`) whose name is
 * also a schema in `api-schema.d.ts`: alias it (`components["schemas"]["X"]`) or narrow it with
 * `WithFields` instead. Only the name is compared, so a request-only or UI-only shape that merely
 * resembles a schema is not flagged. A second check catches a copy under another name: a
 * hand-written object type whose field names equal a schema's (three or more fields).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const LIB_ROOT = __dirname;
/**
 * Hand-written on purpose: the request models accept these under `validation_alias="role"`, so the
 * generated schema shows `role` while the client sends `message_role` (populate_by_name).
 */
const ALLOWED_DECLARATIONS = new Set([
  "helpApi.ts:HelpAskMessage",
  "vendorCopilotApi.ts:CopilotAskMessage",
]);
/**
 * Copies under another name found when the field-name check was added. They belong to other owners'
 * clients and are to be aliased to the schema and removed here; a stale entry fails, so the list only shrinks.
 */
const KNOWN_RENAMED_COPIES = new Set([
  "auth-api.ts:AuthResponse",
  "clientBookingsApi.ts:CreateBookingRequestPayload",
  "clientBookingsApi.ts:ClientBookingCancelResponse",
  "clientExploreApi.ts:ExploreVendor",
  "clientExploreApi.ts:ExploreVendorSearchApiResponse",
  "vendorBookingsApi.ts:PostVendorQuoteBody",
  "vendorCopilotApi.ts:CopilotPackageFeedback",
]);
const SCHEMA_NAME = /^ {8}([A-Za-z0-9_]+): \{/gm;
const HAND_WRITTEN_SHAPE =
  /^(?:export )?(?:interface ([A-Za-z0-9_]+)\b|type ([A-Za-z0-9_]+)\s*=\s*\{)/;

/** Names of every schema in the generated file. */
export function schemaNames(schemaSource: string): Set<string> {
  return new Set(
    [...schemaSource.matchAll(SCHEMA_NAME)].map((match) => match[1]),
  );
}

/** `file:line: declaration` for each hand-written object type named like a generated schema. */
export function handWrittenSchemaShapes(
  file: string,
  source: string,
  names: Set<string>,
): string[] {
  return source.split("\n").flatMap((line, index) => {
    const match = HAND_WRITTEN_SHAPE.exec(line);
    const declared = match?.[1] ?? match?.[2];
    if (declared && ALLOWED_DECLARATIONS.has(`${file}:${declared}`)) return [];
    return declared && names.has(declared)
      ? [`${file}:${index + 1}: ${line.trim()}`]
      : [];
  });
}

const SCHEMA_FIELD = /^ {12}([A-Za-z0-9_]+)\??: /;
const HAND_WRITTEN_FIELD = /^ {2}([A-Za-z0-9_]+)\??: /;
/** Fewer shared field names than this is a coincidence, not a copy. */
const MIN_FIELDS_FOR_COPY = 3;

/** Field names (sorted, comma-joined) of every schema in the generated file, mapped to the schema's name. */
export function schemaFieldSets(schemaSource: string): Map<string, string> {
  const fieldSets = new Map<string, string>();
  let current: { name: string; fields: string[] } | null = null;
  for (const line of schemaSource.split("\n")) {
    const header = /^ {8}([A-Za-z0-9_]+): \{/.exec(line);
    if (header) current = { name: header[1], fields: [] };
    else if (current && /^ {8}\};/.test(line)) {
      if (current.fields.length >= MIN_FIELDS_FOR_COPY) {
        fieldSets.set([...current.fields].sort().join(","), current.name);
      }
      current = null;
    } else if (current) {
      const field = SCHEMA_FIELD.exec(line);
      if (field) current.fields.push(field[1]);
    }
  }
  return fieldSets;
}

/** `file:line: type` for each hand-written object type, under any name, whose field names equal a schema's. */
export function handWrittenSchemaCopies(
  file: string,
  source: string,
  fieldSets: Map<string, string>,
): string[] {
  const lines = source.split("\n");
  const copies: string[] = [];
  lines.forEach((line, index) => {
    const match = HAND_WRITTEN_SHAPE.exec(line);
    const declared = match?.[1] ?? match?.[2];
    if (!declared) return;
    const fields: string[] = [];
    for (const bodyLine of lines.slice(index + 1)) {
      if (/^\}/.test(bodyLine)) break;
      const field = HAND_WRITTEN_FIELD.exec(bodyLine);
      if (field) fields.push(field[1]);
    }
    const schemaName = fieldSets.get([...fields].sort().join(","));
    if (schemaName && fields.length >= MIN_FIELDS_FOR_COPY) {
      copies.push(`${file}:${declared}:${index + 1}: has the fields of schema ${schemaName}`);
    }
  });
  return copies;
}

describe("api clients use the generated schema types", () => {
  it("declares no object type that api-schema.d.ts already has", () => {
    const names = schemaNames(
      readFileSync(path.join(LIB_ROOT, "api-schema.d.ts"), "utf8"),
    );
    expect(names.size).toBeGreaterThan(100);
    const offenders = readdirSync(LIB_ROOT)
      .filter((entry) => /(?:Api|-api)\.ts$/.test(entry))
      .flatMap((entry) =>
        handWrittenSchemaShapes(
          entry,
          readFileSync(path.join(LIB_ROOT, entry), "utf8"),
          names,
        ),
      );
    expect(offenders).toEqual([]);
  });

  it("declares no object type that copies a schema's fields under another name", () => {
    const fieldSets = schemaFieldSets(
      readFileSync(path.join(LIB_ROOT, "api-schema.d.ts"), "utf8"),
    );
    expect(fieldSets.size).toBeGreaterThan(100);
    const offenders = readdirSync(LIB_ROOT)
      .filter((entry) => /(?:Api|-api)\.ts$/.test(entry))
      .flatMap((entry) =>
        handWrittenSchemaCopies(
          entry,
          readFileSync(path.join(LIB_ROOT, entry), "utf8"),
          fieldSets,
        ),
      );
    const unexpected = offenders.filter((offender) => {
      const [file, name] = offender.split(":");
      return !KNOWN_RENAMED_COPIES.has(`${file}:${name}`);
    });
    expect(unexpected).toEqual([]);
    const stale = [...KNOWN_RENAMED_COPIES].filter(
      (known) => !offenders.some((offender) => offender.startsWith(`${known}:`)),
    );
    expect(stale).toEqual([]);
  });

  it("meta: flags a copy under another name and ignores small or different shapes", () => {
    const generated = [
      "        Event: {",
      "            /** Id */",
      "            id: string;",
      "            title: string;",
      "            date?: string | null;",
      "        };",
      "        Tiny: {",
      "            id: string;",
      "        };",
    ].join("\n");
    const fieldSets = schemaFieldSets(generated);
    expect([...fieldSets.values()]).toEqual(["Event"]);
    const source = [
      "export type EventRow = {",
      "  date: string | null;",
      "  id: string;",
      "  title: string;",
      "};",
      "export type EventPick = {",
      "  id: string;",
      "  title: string;",
      "};",
      "export type TinyCopy = {",
      "  id: string;",
      "};",
    ].join("\n");
    expect(handWrittenSchemaCopies("x.ts", source, fieldSets)).toEqual([
      "x.ts:EventRow:1: has the fields of schema Event",
    ]);
  });

  it("meta: flags a hand-written copy of a schema and ignores aliases and unknown names", () => {
    const names = new Set(["ClientEventSummary"]);
    const source = [
      "export type ClientEventSummary = {",
      "  id: string;",
      "};",
      'export type Alias = components["schemas"]["ClientEventSummary"];',
      "export type UiOnlyShape = {",
      "};",
      "export interface ClientEventSummary {",
    ].join("\n");
    expect(handWrittenSchemaShapes("x.ts", source, names)).toEqual([
      "x.ts:1: export type ClientEventSummary = {",
      "x.ts:7: export interface ClientEventSummary {",
    ]);
  });

  it("meta: reads schema names from the generated file layout", () => {
    const generated =
      "    schemas: {\n        Foo: {\n            a: string;\n        };\n        Bar: {\n";
    expect([...schemaNames(generated)]).toEqual(["Foo", "Bar"]);
  });
});
