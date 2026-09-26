import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SessionProvider } from "@/foundation/session";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Eventtz",
  description: "UK events marketplace — find and book vendors for your event.",
};

/** The app shell: fonts and the session provider every page needs. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-page-bg font-sans text-foreground antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
