/**
 * Helpers for aliasing the generated OpenAPI types (`lib/api-schema.d.ts`) in the `*Api.ts`
 * clients. The generated schema is the source of truth; narrow a field by hand only where the
 * API types it as a free-form dict or a plain string.
 */

/**
 * `Schema` with every key of `Narrowed` replaced by its narrower hand-written type, so the
 * rest of the shape keeps following the generated schema.
 */
export type WithFields<Schema, Narrowed> = Omit<Schema, keyof Narrowed> & Narrowed;
