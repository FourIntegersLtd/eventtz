-- Optional tagged costs added by vendor before accepting (delivery, travel, etc.).
-- Run in Supabase SQL Editor after 010_booking_requests.sql.

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS vendor_adjustments jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.booking_requests.vendor_adjustments IS
  'Array of {id, tag, label, amount_gbp} — additions (positive) or discounts (negative) before accept; client total includes Eventtz service fee on top.';
