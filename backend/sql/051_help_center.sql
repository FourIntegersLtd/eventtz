-- Help Center: role-filtered categories + articles (seed content for client & vendor).

CREATE TABLE IF NOT EXISTS public.help_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_key text NOT NULL DEFAULT 'book',
  sort_order int NOT NULL DEFAULT 0,
  audience text NOT NULL CHECK (audience IN ('client', 'vendor', 'both')),
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT help_categories_slug_unique UNIQUE (slug)
);

CREATE TABLE IF NOT EXISTS public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.help_categories (id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body_md text NOT NULL DEFAULT '',
  audience text NOT NULL CHECK (audience IN ('client', 'vendor', 'both')),
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  related_slugs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT help_articles_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_help_categories_audience_sort
  ON public.help_categories (audience, sort_order)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_help_articles_audience_sort
  ON public.help_articles (audience, sort_order)
  WHERE published = true;

CREATE INDEX IF NOT EXISTS idx_help_articles_category
  ON public.help_articles (category_id, sort_order);

COMMENT ON TABLE public.help_categories IS
  'Help Center categories filtered by portal audience (client/vendor/both).';
COMMENT ON TABLE public.help_articles IS
  'Help Center articles (markdown body). Source for browse + AI assistant retrieval.';

-- Fixed category IDs for seed FKs (valid UUID hex only; c… = client, b… = vendor)

INSERT INTO public.help_categories (id, slug, title, description, icon_key, sort_order, audience)
VALUES
  ('c1111111-1111-4111-8111-111111111101', 'client-getting-started', 'Getting started', 'Browse vendors, save favourites, and set up your account.', 'rocket', 10, 'client'),
  ('c1111111-1111-4111-8111-111111111102', 'client-booking', 'Booking', 'Enquire, agree a quote, pay, complete, or cancel.', 'calendar', 20, 'client'),
  ('c1111111-1111-4111-8111-111111111103', 'client-payments', 'Payments & fees', 'When you pay, service fees, and how escrow works.', 'wallet', 30, 'client'),
  ('c1111111-1111-4111-8111-111111111104', 'client-chat', 'Chat & contact sharing', 'Message vendors and share details after payment.', 'message', 40, 'client'),
  ('c1111111-1111-4111-8111-111111111105', 'client-problems', 'Problems & disputes', 'Report an issue and get help from Eventtz.', 'shield', 50, 'client'),
  ('c1111111-1111-4111-8111-111111111106', 'client-account', 'Account', 'Password, settings, and preferred name.', 'settings', 60, 'client'),
  ('b1111111-1111-4111-8111-111111111101', 'vendor-join', 'Join & onboarding', 'Create your profile and submit for review.', 'rocket', 10, 'vendor'),
  ('b1111111-1111-4111-8111-111111111102', 'vendor-go-live', 'Go live & payouts', 'Approval, Stripe Connect, and receiving payouts.', 'wallet', 20, 'vendor'),
  ('b1111111-1111-4111-8111-111111111103', 'vendor-bookings', 'Bookings & quotes', 'Accept, decline, price updates, and custom quotes.', 'calendar', 30, 'vendor'),
  ('b1111111-1111-4111-8111-111111111104', 'vendor-earnings', 'Earnings', 'Fees, when you get paid, and what you keep.', 'wallet', 40, 'vendor'),
  ('b1111111-1111-4111-8111-111111111105', 'vendor-disputes', 'Disputes & support', 'Report a problem and contact Eventtz.', 'shield', 50, 'vendor'),
  ('b1111111-1111-4111-8111-111111111106', 'vendor-profile', 'Profile & analytics', 'Edit your listing and track marketplace performance.', 'user', 60, 'vendor')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
-- Client: getting started
(
  'c1111111-1111-4111-8111-111111111101',
  'client-browse-vendors',
  'How to browse and find vendors',
  'Search by service, location, dates, and budget on Browse.',
  $md$
## How browsing works

Open **Browse** from your portal. You can search in plain English or use filters for vendor type, location, event dates, and budget.

### Tips
- Save vendors you like with the heart icon (Favourites).
- Open a profile to see packages, reviews, and reply expectations.
- If a vendor doesn’t match your search dates, you can still message them to confirm.

Related: favourites and sending an enquiry.
$md$,
  'client', 10, ARRAY['client-favourites', 'client-how-booking-works']
),
(
  'c1111111-1111-4111-8111-111111111101',
  'client-favourites',
  'Saving vendors to Favourites',
  'Keep a shortlist while you compare quotes.',
  $md$
## Favourites

Tap the heart on a vendor card or profile to save them. Open **Favourites** anytime to compare and enquire (including multi-enquire).

Favourites sync when you are signed in.
$md$,
  'client', 20, ARRAY['client-browse-vendors', 'client-multi-enquire']
),
-- Client: booking
(
  'c1111111-1111-4111-8111-111111111102',
  'client-how-booking-works',
  'How does booking work?',
  'Choose a vendor, enquire, agree the price, pay after they accept.',
  $md$
## Booking flow

1. Choose a vendor and add your date (and venue if you have it).
2. Send an enquiry — chat to agree the details and price.
3. When the vendor accepts, you pay the full total (including our service fee).
4. After the event, confirm completion so the vendor can be paid.

Everything stays in one place under **Bookings**.
$md$,
  'client', 10, ARRAY['client-when-do-i-pay', 'client-cancel-refund']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-multi-enquire',
  'Enquiring with several vendors at once',
  'Send the same brief to multiple vendors from Browse.',
  $md$
## Multi-enquire

On Browse, select several vendors and open multi-enquire. Each vendor gets their own booking request with your shared brief.

You can then chat and compare responses before you pay anyone.
$md$,
  'client', 20, ARRAY['client-how-booking-works', 'client-browse-vendors']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-accept-quote',
  'Accepting or declining a vendor quote',
  'Respond to custom quotes and price updates from your booking.',
  $md$
## Quotes and price updates

Vendors may send a custom quote or update the price while the booking is pending. Open the booking to **accept** or **decline**.

You only pay after you and the vendor have agreed and they have accepted the booking.
$md$,
  'client', 30, ARRAY['client-how-booking-works', 'client-when-do-i-pay']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-cancel-refund',
  'Cancelling a booking and refunds',
  'Cancel before the vendor is paid for a full refund to your card.',
  $md$
## Cancellation

You can cancel from your booking before the vendor is paid. If you have already paid, you get a **full refund** back to your card (usually within 5–10 working days).

If something went wrong after the event, use **Disputes** instead of cancelling.
$md$,
  'client', 40, ARRAY['client-report-problem', 'client-when-do-i-pay']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-complete-booking',
  'Confirming the event is complete',
  'Mark the booking complete so payout can proceed.',
  $md$
## After the event

Open the booking and confirm completion when the event went well. The vendor should confirm too. If neither of you reports a problem, payment can release automatically about **48 hours** after the event.
$md$,
  'client', 50, ARRAY['client-how-booking-works', 'client-payment-safe']
),
-- Client: payments
(
  'c1111111-1111-4111-8111-111111111103',
  'client-when-do-i-pay',
  'When do I pay?',
  'After the vendor accepts — you see the full total first.',
  $md$
## Timing

You pay **after the vendor accepts**. Checkout shows the full total, including our service fee, before you confirm payment with Stripe.
$md$,
  'client', 10, ARRAY['client-service-fee', 'client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-service-fee',
  'Is there a service fee?',
  'Yes — 5%, shown before you pay. No hidden extras.',
  $md$
## Service fee

Eventtz charges a **5% service fee** on top of the vendor’s agreed price. It is always shown before you pay. There are no hidden extras on checkout.
$md$,
  'client', 20, ARRAY['client-when-do-i-pay', 'client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-payment-safe',
  'Is my payment safe?',
  'We hold payment until the event is done.',
  $md$
## Escrow-style hold

We hold your payment until the event is done. The vendor is paid once you and the vendor confirm it went well, or automatically **48 hours** after the event if there is no problem.

If you report a problem, we can pause payout while we help sort it out.
$md$,
  'client', 30, ARRAY['client-report-problem', 'client-complete-booking']
),
-- Client: chat
(
  'c1111111-1111-4111-8111-111111111104',
  'client-messaging-vendors',
  'Messaging vendors',
  'Chat from a profile or from your booking thread.',
  $md$
## Messages

Use **Messages** or the chat drawer on a vendor profile to discuss dates, packages, and price before you pay.

Keep important agreements in the booking notes and chat so both sides have a record.
$md$,
  'client', 10, ARRAY['client-how-booking-works', 'client-contact-sharing']
),
(
  'c1111111-1111-4111-8111-111111111104',
  'client-contact-sharing',
  'Contact sharing after payment',
  'Phone and email sharing rules after you pay.',
  $md$
## After you pay

Depending on your settings and the booking stage, Eventtz may share contact details so you can coordinate off-platform. You can review sharing preferences under **Settings**.
$md$,
  'client', 20, ARRAY['client-messaging-vendors', 'client-account-settings']
),
-- Client: problems
(
  'c1111111-1111-4111-8111-111111111105',
  'client-report-problem',
  'What if something goes wrong?',
  'Report a problem from your booking — we may pause payout.',
  $md$
## Disputes

Report a problem from your booking or under **Disputes**. We pause payment to the vendor when appropriate and help sort it out.

For general questions that are not about a paid booking, use **Contact**.
$md$,
  'client', 10, ARRAY['client-contact-support', 'client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111105',
  'client-contact-support',
  'Contact Eventtz support',
  'Reach the team via Contact or this Help assistant.',
  $md$
## Contact

Open **Contact** in the portal to send a message (include a booking ID for booking or payment issues). We aim to reply by email within about two working days.

Use this Help Center for how-to questions first — the assistant can point you to the right article.
$md$,
  'client', 20, ARRAY['client-report-problem', 'client-are-vendors-vetted']
),
(
  'c1111111-1111-4111-8111-111111111105',
  'client-are-vendors-vetted',
  'Are vendors vetted?',
  'Every vendor completes onboarding and is reviewed before going live.',
  $md$
## Vetting

Every vendor completes onboarding. Each profile is reviewed before going live on Eventtz. Look for ratings and completed bookings on the profile for extra confidence.
$md$,
  'client', 30, ARRAY['client-browse-vendors', 'client-how-booking-works']
),
-- Client: account
(
  'c1111111-1111-4111-8111-111111111106',
  'client-password-reset',
  'Resetting your password',
  'Use Forgot password on the sign-in page for a one-click email link.',
  $md$
## Password reset

On the login page, choose **Forgot password**, enter your email, and open the link we send (valid for about one hour). You can also change your password while signed in under **Settings**.
$md$,
  'client', 10, ARRAY['client-account-settings']
),
(
  'c1111111-1111-4111-8111-111111111106',
  'client-account-settings',
  'Account settings',
  'Preferred name, password, and notification preferences.',
  $md$
## Settings

Under **Settings** you can update your preferred name (shown to vendors), change your password, and manage sharing preferences.
$md$,
  'client', 20, ARRAY['client-password-reset', 'client-contact-sharing']
),
-- Vendor: join
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-how-to-join',
  'How do I join Eventtz?',
  'Create your profile, add services, and connect payments.',
  $md$
## Join

1. Register as a vendor.
2. Complete your profile (business, services, portfolio, availability).
3. Connect Stripe for payouts.
4. Submit for review — we approve before you appear on Browse.
$md$,
  'vendor', 10, ARRAY['vendor-onboarding-steps', 'vendor-when-live']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-onboarding-steps',
  'Vendor onboarding steps',
  'Walk through profile steps and submit for review.',
  $md$
## Onboarding

Use **Profile** to complete each step. Save as you go. When you are ready, submit for review. While pending, some fields stay locked until we finish approval.
$md$,
  'vendor', 20, ARRAY['vendor-how-to-join', 'vendor-when-live']
),
-- Vendor: go live
(
  'b1111111-1111-4111-8111-111111111102',
  'vendor-when-live',
  'When will my profile go live?',
  'After setup, Stripe verification, and team approval.',
  $md$
## Going live

Your profile goes live after you finish setup, verify with Stripe, and our team approves your profile. You will see your approval status on the profile and dashboard.
$md$,
  'vendor', 10, ARRAY['vendor-stripe-payouts', 'vendor-how-to-join']
),
(
  'b1111111-1111-4111-8111-111111111102',
  'vendor-stripe-payouts',
  'Connect Stripe and get paid',
  'Complete payout setup before accepting bookings.',
  $md$
## Payouts

Open **Payments** (or follow the prompt when accepting a booking) to connect Stripe. You need charges and payouts enabled before you can accept bookings.

After the event is completed (or auto-released), funds go to your connected Stripe account.
$md$,
  'vendor', 20, ARRAY['vendor-when-get-paid', 'vendor-accept-booking']
),
-- Vendor: bookings
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-accept-booking',
  'Accepting or declining enquiries',
  'Respond from Bookings once payouts are ready.',
  $md$
## Responding

Open **Bookings**, review the enquiry, then accept or decline. If payout setup is incomplete, Eventtz will ask you to finish Stripe Connect first.
$md$,
  'vendor', 10, ARRAY['vendor-stripe-payouts', 'vendor-price-update']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-price-update',
  'Updating the price on a booking',
  'Send charges or discounts while the booking is pending.',
  $md$
## Price updates

On a pending booking you can send an updated price (extra costs or discounts). The client must accept or decline the update before paying.
$md$,
  'vendor', 20, ARRAY['vendor-custom-quote', 'vendor-accept-booking']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-custom-quote',
  'Sending a custom quote from Messages',
  'Create a vendor-initiated booking quote for a client.',
  $md$
## Custom quotes

From a message thread you can send a custom quote (event details + package price). That creates a booking the client can accept and pay.
$md$,
  'vendor', 30, ARRAY['vendor-accept-booking', 'vendor-price-update']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-complete-cancel',
  'Completing or cancelling a booking',
  'Confirm completion after paid events; cancel when needed.',
  $md$
## Completion and cancellation

After a paid event, confirm completion so payout can proceed. You can cancel some bookings from the booking detail when the status allows — check the actions on that booking for what is available.
$md$,
  'vendor', 40, ARRAY['vendor-when-get-paid', 'vendor-dispute']
),
-- Vendor: earnings
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-no-cut',
  'Does Eventtz take a cut from my earnings?',
  'No — clients pay the service fee on top of your quote.',
  $md$
## Fees

Eventtz does **not** take a cut from your agreed quote. Clients pay a **5% service fee** on top. You keep what you agreed with the client.
$md$,
  'vendor', 10, ARRAY['vendor-when-get-paid', 'vendor-stripe-payouts']
),
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-when-get-paid',
  'When do I get paid?',
  'After completion confirmation or automatic release ~48h post-event.',
  $md$
## Timing

When a client books you, payment is held by Eventtz. After the event, mark it complete to get paid — or funds may release automatically about **48 hours** after the event if there is no problem.
$md$,
  'vendor', 20, ARRAY['vendor-no-cut', 'vendor-dispute']
),
-- Vendor: disputes
(
  'b1111111-1111-4111-8111-111111111105',
  'vendor-dispute',
  'What happens if there is a dispute?',
  'Either side can report a problem; payout may be held.',
  $md$
## Disputes

You or the client can report a problem from the booking. We review it and may hold payment until it is sorted. Respond promptly with clear details in the dispute thread.
$md$,
  'vendor', 10, ARRAY['vendor-contact-support', 'vendor-when-get-paid']
),
(
  'b1111111-1111-4111-8111-111111111105',
  'vendor-contact-support',
  'Contact Eventtz support',
  'Use Contact for account and payout questions.',
  $md$
## Contact

Open **Contact** for account, payout, or listing questions. Include booking IDs when relevant. For how-to questions, search this Help Center or ask the assistant first.
$md$,
  'vendor', 20, ARRAY['vendor-dispute', 'vendor-stripe-payouts']
),
-- Vendor: profile
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-edit-profile',
  'Editing your live profile',
  'Update services, portfolio, and availability after approval.',
  $md$
## Live edits

Once approved, open **Profile** to update your listing. Save changes as you go. Major changes may still be reviewed if our team needs to check them.
$md$,
  'vendor', 10, ARRAY['vendor-analytics', 'vendor-when-live']
),
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-analytics',
  'Vendor analytics',
  'See how enquiries convert on Analytics.',
  $md$
## Analytics

Open **Analytics** to see marketplace funnel stats for your profile (views, enquiries, and outcomes over a period). Use it to improve response time and packages.
$md$,
  'vendor', 20, ARRAY['vendor-edit-profile', 'vendor-accept-booking']
)
ON CONFLICT (slug) DO NOTHING;
