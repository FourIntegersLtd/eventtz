"use client";

import { RotatingTypewriterPlaceholder } from "@/components/ui/RotatingTypewriterPlaceholder";
import type { PortalRole } from "@/components/portal-shell/portalNav";
import { contactMessagePlaceholderExamples } from "@/features/contact/contactMessagePlaceholders";

type RotatingContactMessagePlaceholderProps = {
  role: PortalRole;
  visible: boolean;
};

/** Same typewriter overlay pattern as marketplace search on the landing page. */
export function RotatingContactMessagePlaceholder({
  role,
  visible,
}: RotatingContactMessagePlaceholderProps) {
  return (
    <RotatingTypewriterPlaceholder
      examples={contactMessagePlaceholderExamples(role)}
      visible={visible}
      align="top"
      wrap
      compact
      className="px-3 pt-2.5"
    />
  );
}
