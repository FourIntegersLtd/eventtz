/**
 * Where to send an anonymous visitor, remembering where they were headed.
 *
 * `next` round-trips through `/login`'s own query string
 * (`domains/auth/useLogin.ts`), matching the baseline's `resolvePostAuthPath`.
 */
export function loginHref(pathname: string, sessionExpired: boolean): string {
  const next = encodeURIComponent(pathname || "/");
  const suffix = sessionExpired ? "&expired=1" : "";
  return `/login?next=${next}${suffix}`;
}
