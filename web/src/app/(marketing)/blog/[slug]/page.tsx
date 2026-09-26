import type { Metadata } from "next";
import { BlogPostView } from "@/domains/marketing/BlogPostView";
import { MarketingShell } from "@/domains/marketing/MarketingShell";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: "Blog | Eventtz",
    description: `Read "${slug.replace(/-/g, " ")}" on the Eventtz blog.`,
  };
}

/** `/blog/[slug]` — one published post. */
export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <MarketingShell>
      <BlogPostView key={slug} slug={slug} />
    </MarketingShell>
  );
}
