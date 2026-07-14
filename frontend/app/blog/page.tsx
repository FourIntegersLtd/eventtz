import type { Metadata } from "next";
import { BlogSiteChrome } from "@/features/blog/BlogSiteChrome";
import { BlogIndexView } from "@/features/blog/BlogIndexView";

export const metadata: Metadata = {
  title: "Blog | Eventtz",
  description: "Stories, tips, and updates from the Eventtz team.",
};

export default function BlogPage() {
  return (
    <BlogSiteChrome>
      <BlogIndexView />
    </BlogSiteChrome>
  );
}
