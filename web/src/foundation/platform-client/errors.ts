import type { components } from "@/foundation/platform-client/schema";

/**
 * Every error code the platform API can return, as a union.
 *
 * Generated from `api/openapi.json`, where `ErrorResponse.code` is an enum of
 * the whole `AppError` hierarchy (see `api/app/core/errors.py`). A code that
 * does not exist is a compile error, and a code the API removes breaks the
 * build the next time `npm run api:types` runs — which is the point: the
 * frontend must branch on `code`, never on message text (AGENTS.md).
 */
export type PlatformErrorCode = components["schemas"]["ErrorResponse"]["code"];

export type PlatformErrorBody = components["schemas"]["ErrorResponse"];

/**
 * A failed request, with the machine-readable parts kept.
 *
 * Collapsing a response into `new Error(message)` discards the status and the
 * body, which pushes callers into matching English messages. Switch on
 * `code`; `detail` is for showing a human only.
 *
 * `status`, `code`, `details` and `requestId` are named to match the brief
 * (`docs/rebuild-workstreams.md` §10), but the API's `ErrorResponse` is only
 * `{ detail, code }` (`api/app/core/errors.py`) — there is no structured
 * `details` object or `request_id` yet, so those two are always `null` until
 * the API adds them.
 */
export class PlatformError extends Error {
  readonly code: PlatformErrorCode;
  readonly status: number;
  readonly detail: string;
  readonly details: Record<string, unknown> | null;
  /** Correlates with the API's structured logs, once the API sends one. */
  readonly requestId: string | null;

  constructor(status: number, body: PlatformErrorBody) {
    super(body.detail);
    this.name = "PlatformError";
    this.status = status;
    this.code = body.code;
    this.detail = body.detail;
    this.details = null;
    this.requestId = null;
  }

  /** `error.hasCode("invalid_input")` — narrows without importing `hasCode` separately. */
  hasCode(...codes: readonly PlatformErrorCode[]): boolean {
    return codes.includes(this.code);
  }
}

/**
 * A request that never reached the API — offline, DNS, a dropped connection,
 * an aborted fetch. Distinct from `PlatformError` because there is no code to
 * switch on and retrying is usually right, whereas retrying a 409 is not.
 */
export class PlatformTransportError extends Error {
  readonly cause: unknown;

  constructor(message: string, cause: unknown) {
    super(message);
    this.name = "PlatformTransportError";
    this.cause = cause;
  }
}

export function isPlatformError(err: unknown): err is PlatformError {
  return err instanceof PlatformError;
}

/** `hasCode(err, "unauthenticated", "forbidden")` — narrows for the caller. */
export function hasCode(err: unknown, ...codes: readonly PlatformErrorCode[]): err is PlatformError {
  return isPlatformError(err) && codes.includes(err.code);
}
