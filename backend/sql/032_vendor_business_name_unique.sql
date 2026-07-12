-- Enforce unique vendor business names (case- and whitespace-insensitive).
-- Run after backend/sql/031_admin_team.sql
--
-- Safe to re-run: resolves duplicate names, then adds the unique index.
-- Duplicate resolution: delete vendor rows with no bookings when a namesake has bookings;
-- if none have bookings, keep the oldest and delete the rest; any still-duplicated rows get renamed.

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS business_name_normalized text
  GENERATED ALWAYS AS (
    NULLIF(
      lower(
        regexp_replace(
          trim(COALESCE(payload->>'businessName', '')),
          '\s+',
          ' ',
          'g'
        )
      ),
      ''
    )
  ) STORED;

WITH normalized AS (
  SELECT
    v.id,
    v.user_id,
    v.payload,
    v.created_at,
    NULLIF(
      lower(
        regexp_replace(
          trim(COALESCE(v.payload->>'businessName', '')),
          '\s+',
          ' ',
          'g'
        )
      ),
      ''
    ) AS norm
  FROM public.vendors v
),
dupe_norms AS (
  SELECT norm
  FROM normalized
  WHERE norm IS NOT NULL
  GROUP BY norm
  HAVING count(*) > 1
),
with_bookings AS (
  SELECT
    n.*,
    EXISTS (
      SELECT 1
      FROM public.booking_requests br
      WHERE br.vendor_user_id = n.user_id
    ) AS has_bookings
  FROM normalized n
  INNER JOIN dupe_norms d ON d.norm = n.norm
),
group_stats AS (
  SELECT norm, bool_or(has_bookings) AS any_bookings
  FROM with_bookings
  GROUP BY norm
),
keepers AS (
  SELECT DISTINCT ON (wb.norm)
    wb.norm,
    wb.id AS keeper_id
  FROM with_bookings wb
  ORDER BY wb.norm, wb.has_bookings DESC, wb.created_at ASC NULLS LAST, wb.id ASC
),
delete_ids AS (
  SELECT wb.id
  FROM with_bookings wb
  INNER JOIN group_stats gs ON gs.norm = wb.norm
  WHERE
    (
      NOT wb.has_bookings
      AND gs.any_bookings
    )
    OR (
      NOT gs.any_bookings
      AND wb.id <> (SELECT k.keeper_id FROM keepers k WHERE k.norm = wb.norm)
    )
)
DELETE FROM public.vendors v
USING delete_ids d
WHERE v.id = d.id;

-- Remaining duplicates (e.g. two vendors with bookings under the same name): suffix the newer ones.
WITH normalized AS (
  SELECT
    v.id,
    v.user_id,
    v.payload,
    v.created_at,
    NULLIF(
      lower(
        regexp_replace(
          trim(COALESCE(v.payload->>'businessName', '')),
          '\s+',
          ' ',
          'g'
        )
      ),
      ''
    ) AS norm
  FROM public.vendors v
),
ranked AS (
  SELECT
    n.id,
    n.norm,
    ROW_NUMBER() OVER (
      PARTITION BY n.norm
      ORDER BY
        EXISTS (
          SELECT 1
          FROM public.booking_requests br
          WHERE br.vendor_user_id = n.user_id
        ) DESC,
        n.created_at ASC NULLS LAST,
        n.id ASC
    ) AS rn
  FROM normalized n
  WHERE n.norm IS NOT NULL
),
still_duped AS (
  SELECT norm
  FROM ranked
  GROUP BY norm
  HAVING count(*) > 1
)
UPDATE public.vendors v
SET payload = jsonb_set(
  v.payload,
  '{businessName}',
  to_jsonb(
    trim(v.payload->>'businessName') || ' (' || left(v.user_id::text, 8) || ')'
  ),
  true
)
FROM ranked r
INNER JOIN still_duped sd ON sd.norm = r.norm
WHERE v.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_vendors_business_name_normalized_unique
  ON public.vendors (business_name_normalized)
  WHERE business_name_normalized IS NOT NULL;

COMMENT ON COLUMN public.vendors.business_name_normalized IS
  'Generated from payload.businessName for uniqueness checks (lowercase, trimmed, collapsed spaces).';
