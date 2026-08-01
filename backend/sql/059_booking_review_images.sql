-- Client review photos (Amazon-style attachments on booking reviews).
alter table public.booking_reviews
  add column if not exists image_urls text[] not null default '{}';

comment on column public.booking_reviews.image_urls is
  'Public image URLs uploaded by the client with the review (max enforced in app).';
