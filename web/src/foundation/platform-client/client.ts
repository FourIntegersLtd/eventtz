import {
  PlatformError,
  PlatformTransportError,
  type PlatformErrorBody,
} from "@/foundation/platform-client/errors";

/**
 * The unified platform API client.
 *
 * One backend (`api/`) serves clients, vendors and staff, so there is one
 * request function rather than the baseline's ~many inline `axios` calls
 * spread across `lib/*-api.ts` files. Built on `fetch` deliberately, ported
 * from OSCE `platform-web`'s `platformRequest`.
 */

export function platformApiUrl(): string {
  // Browser: always same-origin (proxied to `api/` in dev — see next.config.ts).
  // `NEXT_PUBLIC_PLATFORM_API_URL` is for SSR and tooling only; using it in
  // the browser crosses origins and breaks sign-in without CORS configured.
  if (typeof window !== "undefined") return "";
  const explicit = process.env.NEXT_PUBLIC_PLATFORM_API_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const server = process.env.PLATFORM_API_URL?.trim();
  return (server || "http://127.0.0.1:8001").replace(/\/+$/, "");
}

type TokenSource = () => string | null | Promise<string | null>;

let readToken: TokenSource = () => null;

/**
 * Supply the access token. Set once where the session lives
 * (`foundation/session/SessionProvider.tsx`), rather than each call site
 * reaching for storage.
 */
export function setPlatformTokenSource(source: TokenSource): void {
  readToken = source;
}

export interface RequestOptions {
  method?: string;
  /** Serialised as JSON. Use `formData` for uploads. */
  body?: unknown;
  formData?: FormData;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Sent as `Idempotency-Key`, for a repeated POST that must be one action. */
  idempotencyKey?: string;
}

function withQuery(path: string, query: RequestOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function asErrorBody(status: number, payload: unknown): PlatformErrorBody {
  if (payload && typeof payload === "object") {
    const parsed = payload as Record<string, unknown>;
    if (typeof parsed.code === "string" && typeof parsed.detail === "string") {
      return parsed as unknown as PlatformErrorBody;
    }
  }
  // A proxy, a gateway, or a crash before the API's error handler ran.
  // Shaped like `ErrorResponse` so callers still have one thing to handle.
  return { code: "internal_error", detail: `Request failed (${status})` };
}

/** Issue one request against the platform API and decode its JSON body. */
export async function platformRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, formData, query, signal, idempotencyKey } = options;

  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  const token = await readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  // FormData sets its own multipart boundary; setting Content-Type breaks it.
  if (body !== undefined && !formData) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${platformApiUrl()}${withQuery(path, query)}`, {
      method,
      headers,
      signal,
      credentials: "omit",
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new PlatformTransportError("Could not reach the server", cause);
  }

  if (response.status === 204) return undefined as T;

  const raw = await response.text();
  let payload: unknown = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (!response.ok) throw new PlatformError(response.status, asErrorBody(response.status, payload));
  return payload as T;
}

/** A successful platform response whose body was read as plain text (HTML, CSV, …). */
export interface PlatformTextResponse {
  text: string;
  headers: Headers;
}

/**
 * Like `platformRequest`, but returns the raw response body and headers instead
 * of parsing JSON. Used for receipt `.html` downloads and other non-JSON GETs.
 */
export async function platformRequestText(
  path: string,
  options: RequestOptions = {},
): Promise<PlatformTextResponse> {
  const { method = "GET", body, formData, query, signal, idempotencyKey } = options;

  const headers: Record<string, string> = { Accept: "*/*", ...options.headers };
  const token = await readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  if (body !== undefined && !formData) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${platformApiUrl()}${withQuery(path, query)}`, {
      method,
      headers,
      signal,
      credentials: "omit",
      body: formData ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new PlatformTransportError("Could not reach the server", cause);
  }

  const text = await response.text();
  if (!response.ok) {
    let payload: unknown = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }
    throw new PlatformError(response.status, asErrorBody(response.status, payload));
  }

  return { text, headers: response.headers };
}
