"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

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
      <body className="min-h-dvh bg-page-bg px-6 py-16 text-foreground antialiased">
        <main className="mx-auto max-w-md text-center">
          <h1 className="font-heading text-2xl text-primary">
            Something went wrong
          </h1>
          <p className="mt-3 text-sm text-neutral-600">
            Please refresh the page. If this keeps happening, try again in a
            few minutes.
          </p>
        </main>
      </body>
    </html>
  );
}
