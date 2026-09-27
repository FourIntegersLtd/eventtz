import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { SessionProvider } from "@/foundation/session";
import "@/app/globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Eventtz - African event vendors in the UK",
  description:
    "Find and book UK-based African vendors for weddings, parties, and corporate events - catering, photography, decor, DJs, MCs, hair styling, and more. Prices in GBP.",
};

/** The app shell: Fraunces and Plus Jakarta Sans, then the session provider every page needs. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${jakarta.variable} min-h-dvh overflow-x-hidden bg-page-bg font-sans text-foreground antialiased`}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
