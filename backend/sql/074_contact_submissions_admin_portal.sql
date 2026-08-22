-- Allow staff bug reports on the same contact_submissions table.

ALTER TABLE public.contact_submissions
  DROP CONSTRAINT IF EXISTS contact_submissions_portal_check;

ALTER TABLE public.contact_submissions
  ADD CONSTRAINT contact_submissions_portal_check
  CHECK (portal IN ('client', 'vendor', 'admin'));
