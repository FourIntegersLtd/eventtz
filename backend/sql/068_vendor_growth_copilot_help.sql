-- Help Center: Vendor Growth Co-pilot articles.

INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-growth-copilot',
  'Your Growth Co-pilot',
  'Daily tips, Growth Score, and AI help to win more bookings.',
  $md$
## What is the Growth Co-pilot?

The **Growth Co-pilot** is your personal helper inside the vendor portal. It reads your real numbers (profile views, enquiries, response time) and suggests what to do next.

Open it from the **sparkle button** on any vendor page, or read **Today's focus** on your dashboard.

## Growth Score

Your **Growth Score** (0 to 100) tracks:

- Listing quality (photo, bio, packages, portfolio)
- Response speed
- Booking conversion
- Client reviews
- Availability

Improve the areas marked **needs work** first. The co-pilot never changes your profile automatically — you always review and save.

## Listing optimizer

On your **Profile → Pricing** section, tap **Help me improve my packages** to get AI suggestions for clearer package names and descriptions. Apply changes, then save your profile.

## Draft replies

On a pending booking, use **Draft accept message** to get a starting reply. Edit it before you send — AI can make mistakes.

## When to contact Eventtz

For refunds, disputes, payout problems, or account suspension, use **Contact** in the portal. The co-pilot will point you there for money questions.
$md$,
  'vendor',
  35,
  ARRAY['vendor-analytics-overview', 'vendor-onboarding-ai-packages']
),
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-growth-score-explained',
  'Understanding your Growth Score',
  'What each lever means and how to improve it.',
  $md$
## Listing quality

Clients need a clear photo, bio, bookable packages, and portfolio photos. Complete at least one package with name, price, and what's included.

## Response speed

Reply to new enquiries within **2 hours** when you can. Slow replies lower your score and clients may book someone else.

## Booking conversion

This measures enquiries that become completed bookings. Accept suitable jobs promptly and keep packages accurate.

## Reviews

After a great event, happy clients can leave a review. Strong reviews help you stand out on Browse.

## Availability

Set which weekdays you take bookings and your daily limit. Block dates when you are fully booked.
$md$,
  'vendor',
  36,
  ARRAY['vendor-growth-copilot', 'vendor-analytics-overview']
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md,
  sort_order = EXCLUDED.sort_order,
  related_slugs = EXCLUDED.related_slugs,
  updated_at = now();
