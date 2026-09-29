import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Vendor profile - Eventtz",
  description:
    "Complete your Eventtz vendor profile: business details, pricing, portfolio, and verification.",
};

/** Pass-through layout so the wizard page can set its own title. */
export default function VendorProfileLayout({ children }: { children: ReactNode }) {
  return children;
}
