"use client";

import type { ReactNode } from "react";
import { ContentCard, SectionBlock } from "@/components/ui/SectionBlock";

/** Settings page section: prominent header + white card on page canvas. */
export function SettingsSection({
  title,
  description,
  trailing,
  children,
}: {
  title: string;
  description?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SectionBlock title={title} description={description} trailing={trailing}>
      {children != null ? (
        <ContentCard padding="none" className="overflow-hidden">
          {children}
        </ContentCard>
      ) : null}
    </SectionBlock>
  );
}
