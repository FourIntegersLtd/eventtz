import type { Metadata } from "next";
import { BlogIndexView } from "@/domains/marketing/BlogIndexView";
import { MarketingShell } from "@/domains/marketing/MarketingShell";

export const metadata: Metadata = {
  title: "Blog | Eventtz",
  description: "Stories, tips, and updates from the Eventtz team.",
};

/** `/blog` — the public blog index. */
export default function BlogPage() {
  return (
    <MarketingShell>
      <BlogIndexView />
    </MarketingShell>
  );
}
