-- Public display name for blog post authors ("By …" on the marketing blog).

ALTER TABLE public.blog_posts
  ADD COLUMN IF NOT EXISTS author_name text;

COMMENT ON COLUMN public.blog_posts.author_name IS
  'Display name shown as "By …" on public blog pages; independent of author_admin_user_id.';
