import { isPlatformError } from "@/foundation/platform-client/errors";

/** Shown when the API's error detail is missing or should not be surfaced verbatim. */
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * The API's `ErrorResponse.detail`, or `null` for a non-platform error (a
 * transport failure, an unexpected throw). Shared by every domain's error
 * handling so `PlatformError` unwrapping lives in one place (`foundation`,
 * not any one domain — the boundaries config forbids one domain importing
 * another).
 */
export function platformErrorDetail(error: unknown): string | null {
  return isPlatformError(error) ? error.detail : null;
}
