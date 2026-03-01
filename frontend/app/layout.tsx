import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Eventtz — Find & Book Event Vendors in the UK",
  description:
    "Eventtz connects you to photographers, caterers, decorators, makeup artists and more — all in one seamless marketplace.",
  // Use high-res source so the tab icon stays sharp. Prefer 256×256+ PNG for eventtz-favicon.png
  icons: {
    icon: [
      { url: "/images/eventtz-favicon.png", sizes: "any", type: "image/png" },
      { url: "/images/eventtz-favicon.png", sizes: "192x192", type: "image/png" },
      { url: "/images/eventtz-favicon.png", sizes: "256x256", type: "image/png" },
    ],
    apple: [
      { url: "/images/eventtz-favicon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${jakarta.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
