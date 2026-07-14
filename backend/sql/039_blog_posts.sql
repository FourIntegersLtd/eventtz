-- Blog CMS: Substack-style posts (draft / published) with rich body storage.

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL DEFAULT '',
  subtitle text,
  cover_image_url text,
  body_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  body_html text NOT NULL DEFAULT '',
  excerpt text,
  status text NOT NULL DEFAULT 'draft',
  author_admin_user_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_status_check CHECK (status IN ('draft', 'published')),
  CONSTRAINT blog_posts_slug_nonempty CHECK (length(trim(slug)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS blog_posts_slug_unique
  ON public.blog_posts (slug);

CREATE INDEX IF NOT EXISTS idx_blog_posts_published_feed
  ON public.blog_posts (status, published_at DESC NULLS LAST)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS idx_blog_posts_updated
  ON public.blog_posts (updated_at DESC);

COMMENT ON TABLE public.blog_posts IS
  'Public marketing blog; admins draft/publish. body_json = TipTap doc; body_html = sanitized HTML for readers.';
