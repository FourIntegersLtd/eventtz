import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The shared shell every `(auth)` page renders inside: a centred column on
 * the auth background, with the wordmark linking home.
 *
 * Ported (simplified) from the baseline's `components/auth/AuthPageShell`.
 * Lottie illustrations and the admin-portal variant are left out: they need
 * a Lottie player package this workstream is not approved to install (see
 * the final report), and the admin auth variant belongs to the admin portal
 * workstream, not this one.
 */
export function AuthShell({ children, logoHref = "/" }: { children: ReactNode; logoHref?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center bg-auth-bg px-4 py-10">
      <Link href={logoHref} className="mb-8 font-heading text-xl font-semibold text-primary">
        Eventtz
      </Link>
      <div className="flex w-full flex-1 items-start justify-center">{children}</div>
    </main>
  );
}
