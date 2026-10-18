"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { EventtzLogo } from "@/components/branding/EventtzLogo";
import { Card } from "@/components/ui/Card";
import "./globals.css";

/**
 * Last-resort error page. It renders without the root layout, so it imports
 * the global stylesheet itself and uses only token classes and the logo.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-dvh bg-page-bg px-4 py-10 text-ink antialiased">
        <header className="mx-auto flex w-full max-w-5xl justify-center sm:justify-start">
          <EventtzLogo href="/" variant="header" priority />
        </header>
        <main className="mx-auto mt-16 max-w-md sm:mt-24">
          <Card padding="lg" className="text-center shadow-card">
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-ink">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-2">
              Please refresh the page. If this keeps happening, try again in a
              few minutes.
            </p>
          </Card>
        </main>
      </body>
    </html>
  );
}
