import type { Metadata } from "next";
import { BlogSiteChrome } from "@/features/blog/BlogSiteChrome";
import { BlogPostView } from "@/features/blog/BlogPostView";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Blog | Eventtz`,
    description: `Read “${slug.replace(/-/g, " ")}” on the Eventtz blog.`,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  return (
    <BlogSiteChrome>
      <BlogPostView slug={slug} />
    </BlogSiteChrome>
  );
}
