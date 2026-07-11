import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vendor profile — Eventtz",
  description:
    "Complete your Eventtz vendor profile: business details, pricing, portfolio, and verification.",
};

export default function VendorProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
