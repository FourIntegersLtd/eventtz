"use client";

import Link from "next/link";
import { authPageGradient } from "@/components/portal-shell/portalTheme";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { getButtonClassName } from "@/components/ui/buttonStyles";

export function NotFoundView() {
  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-page-bg px-4 py-12 text-center">
      <div
        className={`pointer-events-none absolute inset-0 ${authPageGradient}`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-0 h-96 w-96 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center">
        <LottieIllustration
          asset="notFound"
          className="h-[min(55vh,28rem)] w-[min(55vh,28rem)] max-w-full"
          ariaLabel="Page not found illustration"
        />
        <h1 className="font-heading mt-2 text-3xl font-semibold text-neutral-900 sm:text-4xl">
          Page not found
        </h1>
        <p className="mt-3 max-w-md text-base leading-relaxed text-neutral-600">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link href="/" className={getButtonClassName({ className: "mt-8 px-6 py-3" })}>
          Back to home
        </Link>
      </div>
    </main>
  );
}
