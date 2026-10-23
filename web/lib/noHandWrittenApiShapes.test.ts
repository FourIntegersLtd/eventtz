/**
 * ADR 0007: the generated `lib/api-schema.d.ts` is the source of truth for API shapes. This fails
 * when a `lib/*Api.ts` client declares an object type (`type X = {` or `interface X`) whose name is
 * also a schema in `api-schema.d.ts`: alias it (`components["schemas"]["X"]`) or narrow it with
 * `WithFields` instead. Only the name is compared, so a request-only or UI-only shape that merely
 * resembles a schema is not flagged.
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
