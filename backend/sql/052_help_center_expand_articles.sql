-- Expand Help Center articles (longer step-by-step guides) + fill gaps.
-- Safe to re-run: upserts by slug. Run after 051_help_center.sql.

UPDATE public.help_categories
SET
  description = 'Approval first. Connect Stripe when you are ready to accept bookings.',
  updated_at = now()
WHERE slug = 'vendor-go-live';

INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
-- ========== CLIENT: getting started ==========
(
  'c1111111-1111-4111-8111-111111111101',
  'client-create-account',
  'Create a client account',
  'Sign up, verify your email if asked, then open your portal.',
  $md$
## Create your account

1. Open **Client register** from the Eventtz site.
2. Enter your email and a password you will remember.
3. Complete any email verification steps if we ask for them.
4. Sign in. You land on your **Dashboard**.

### First visit

On your first visits we may ask for a **preferred name**. Vendors see this instead of your raw email on bookings. You can change it later under **Settings**.

### What to do next

1. Open **Browse** to search for vendors.
2. Save favourites while you compare.
3. Send an enquiry when you are ready.

If you already have an account, use **Client login**. Use **Forgot password** if you cannot sign in.
$md$,
  'client', 5, ARRAY['client-browse-vendors', 'client-account-settings', 'client-password-reset']
),
(
  'c1111111-1111-4111-8111-111111111101',
  'client-browse-vendors',
  'How to browse and find vendors',
  'Search by service, location, dates, and budget on Browse.',
  $md$
## Open Browse

From your client portal, open **Browse**. This is the marketplace of approved vendors.

### Search and filters

You can:

- Type a plain-English search (for example “Nigerian catering in Manchester for 80 guests”).
- Filter by vendor type (baking, catering, photography, makeup, rentals, and more).
- Set location, event dates, and budget when those filters are available.

### Read a profile before you enquire

Open a vendor card to see:

- Packages and list prices
- Portfolio and credentials
- Reviews and completed bookings (when available)
- Typical reply expectations

### Tips

- Save vendors you like with the heart icon (**Favourites**).
- If dates look tight, still enquire. The vendor can confirm availability in chat.
- Compare a few vendors before you pay anyone.

Next: save favourites, then send an enquiry from a profile or from multi-enquire.
$md$,
  'client', 10, ARRAY['client-favourites', 'client-how-booking-works', 'client-are-vendors-vetted']
),
(
  'c1111111-1111-4111-8111-111111111101',
  'client-favourites',
  'Saving vendors to Favourites',
  'Keep a shortlist while you compare quotes.',
  $md$
## Favourites

Tap the **heart** on a vendor card or profile to save them. Open **Favourites** in the sidebar anytime to see your shortlist.

### Why use Favourites

- Compare packages side by side without losing people in search.
- Multi-enquire several saved vendors with the same brief.
- Return later if you are still deciding dates or budget.

Favourites sync when you are signed in. Unsaving removes them from your list only. It does not cancel any booking you already started.
$md$,
  'client', 20, ARRAY['client-browse-vendors', 'client-multi-enquire']
),

-- ========== CLIENT: booking ==========
(
  'c1111111-1111-4111-8111-111111111102',
  'client-how-booking-works',
  'How does booking work?',
  'Enquire, agree details and price, pay after accept, confirm after the event.',
  $md$
## End-to-end booking flow

Follow these steps in order.

### 1. Choose a vendor

Browse profiles, check packages and reviews, then open the vendor you want.

### 2. Send an enquiry

Add your event date (and venue or postcode when you have it). Choose packages or options the vendor offers. Send the enquiry.

That creates a **booking request** you can track under **Bookings**.

### 3. Chat and agree

Use **Messages** (or the chat on the booking) to agree scope, timing, and price. The vendor may send a price update or custom quote. Accept or decline updates from the booking.

### 4. Vendor accepts

When the vendor accepts, the booking is ready for payment. You do **not** pay before accept.

### 5. Pay

Open the booking and start checkout. You see the full total, including the Eventtz service fee, before you pay with Stripe.

### 6. Coordinate

After payment, use chat and any shared contact details to finalise logistics.

### 7. After the event

Confirm completion when things went well. That helps release payment to the vendor. If there is a problem, open a dispute instead.

Everything for one booking stays under **Bookings** so you have one place for status, pay, chat, and disputes.
$md$,
  'client', 10, ARRAY['client-when-do-i-pay', 'client-complete-booking', 'client-cancel-refund']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-multi-enquire',
  'Enquiring with several vendors at once',
  'Send the same brief to multiple vendors from Browse.',
  $md$
## Multi-enquire

Use multi-enquire when you want options before you commit.

### Steps

1. On **Browse** (or **Favourites**), select more than one vendor.
2. Open multi-enquire and fill one shared brief (date, location, notes, packages where asked).
3. Submit. Each vendor gets their **own** booking request with that brief.

### What happens next

- Chat separately with each vendor.
- Compare quotes and response times.
- Pay only the vendor you choose after they accept.
- Cancel or ignore the others you no longer need (when the booking status allows).

Multi-enquire does not charge you. Payment only happens after a vendor accepts and you complete checkout on that booking.
$md$,
  'client', 20, ARRAY['client-how-booking-works', 'client-browse-vendors', 'client-favourites']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-accept-quote',
  'Accepting or declining a vendor quote',
  'Respond to custom quotes and price updates from your booking.',
  $md$
## Quotes and price updates

While a booking is still pending, a vendor may:

- Send a **custom quote** (often from Messages)
- Send a **price update** (extras or a discount)

### What you should do

1. Open the booking under **Bookings**.
2. Read the new total and line items carefully.
3. **Accept** if you agree, or **Decline** if you do not.

### Before you pay

You only pay after:

1. You and the vendor have agreed the price, and
2. The vendor has **accepted** the booking.

If you decline a price update, keep chatting or cancel the enquiry if you are done with that vendor.
$md$,
  'client', 30, ARRAY['client-how-booking-works', 'client-when-do-i-pay', 'client-messaging-vendors']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-cancel-refund',
  'Cancelling a booking and refunds',
  'Cancel before the vendor is paid for a full refund to your card.',
  $md$
## When you can cancel

Open the booking and use **Cancel** when the status allows it. Typical cases:

- Enquiry still pending (vendor has not accepted yet)
- Vendor accepted but you have not paid yet
- You have paid but payout to the vendor has not happened yet

### If you already paid

If you cancel before the vendor is paid out, you get a **full refund** to your card. Banks often take **5 to 10 working days** to show the money.

### After the event

Do **not** use cancel for a problem after the event. Open a **dispute** from the booking so we can pause payout and help.

### Vendor cancelled

If the vendor cancels a paid booking, we refund you. Contact support from **Contact** if something looks wrong.
$md$,
  'client', 40, ARRAY['client-report-problem', 'client-when-do-i-pay', 'client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-complete-booking',
  'Confirming the event is complete',
  'Mark the booking complete so payout can proceed.',
  $md$
## After the event

When the event went well:

1. Open the booking under **Bookings**.
2. Confirm **completion** when you are prompted.
3. The vendor should confirm on their side too.

### Automatic release

If nobody reports a problem, payment can release automatically about **48 hours** after the event end time.

### If something went wrong

Do not confirm completion. Open a **dispute** from the booking so we can hold payout and review.

### Reviews

After a successful booking you may be asked to leave a review. Honest reviews help other clients choose vendors.
$md$,
  'client', 50, ARRAY['client-how-booking-works', 'client-payment-safe', 'client-leave-review']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-leave-review',
  'Leaving a review after a booking',
  'Rate and comment once the booking is complete.',
  $md$
## Reviews

After a completed booking, Eventtz may invite you to leave a review on the vendor profile.

### Tips

- Be fair and specific (punctuality, quality, communication).
- Reviews help other clients and reward good vendors.
- If you still have an open dispute, sort that first before reviewing.

You can find past reviews linked from **Settings** when that section is available.
$md$,
  'client', 60, ARRAY['client-complete-booking', 'client-are-vendors-vetted']
),

-- ========== CLIENT: payments ==========
(
  'c1111111-1111-4111-8111-111111111103',
  'client-when-do-i-pay',
  'When do I pay?',
  'After the vendor accepts. You see the full total first.',
  $md$
## Timing

You pay **after the vendor accepts** the booking. You do not pay to send an enquiry.

### Checkout steps

1. Open the accepted booking under **Bookings**.
2. Choose **Pay** / checkout.
3. Review the full total (packages, agreed changes, and the Eventtz service fee).
4. Pay securely with Stripe.

### After payment

The booking payment status updates. We hold the funds until completion rules are met (see “Is my payment safe?”).

If checkout fails, try again from the same booking or use **Contact** with the booking ID.
$md$,
  'client', 10, ARRAY['client-service-fee', 'client-payment-safe', 'client-how-booking-works']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-service-fee',
  'Is there a service fee?',
  'Yes. 5%, shown before you pay. No hidden extras.',
  $md$
## Service fee

Eventtz charges a **5% service fee** on top of the vendor’s agreed quote (packages and discounts as shown on the booking).

### What you see

Checkout always shows:

- Vendor amount
- Service fee
- **Total** you pay

There are no surprise extras at payment time beyond what the booking already shows (for example agreed extras the vendor added and you accepted).

### What vendors keep

Vendors keep the agreed quote. The service fee is paid by you on top. Eventtz does not take a cut out of the vendor’s quote.
$md$,
  'client', 20, ARRAY['client-when-do-i-pay', 'client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-payment-safe',
  'Is my payment safe?',
  'We hold payment until the event is done.',
  $md$
## How we hold payment

When you pay, Eventtz holds the money. The vendor is not paid the moment you check out.

### When the vendor gets paid

Payment can release when:

- You and the vendor confirm the event went well, or
- About **48 hours** after the event if nobody reports a problem

### If there is a problem

Report it from the booking (**Disputes**). We can pause payout while we review.

### Cards and Stripe

Checkout runs through Stripe. Eventtz does not store your full card number on our servers.
$md$,
  'client', 30, ARRAY['client-report-problem', 'client-complete-booking', 'client-cancel-refund']
),

-- ========== CLIENT: chat ==========
(
  'c1111111-1111-4111-8111-111111111104',
  'client-messaging-vendors',
  'Messaging vendors',
  'Chat from a profile or from your booking thread.',
  $md$
## Where to chat

- Open **Messages** in the sidebar for all conversations.
- Start or continue chat from a vendor profile before or after you enquire.
- Open chat from a booking so the thread stays tied to that event.

### What to discuss in chat

- Dates, guest count, venue details
- Package choices and extras
- Price changes (confirm them on the booking when prompted)

### Good practice

Keep important agreements in Eventtz chat or on the booking so both sides have a record. After you pay, you may also share phone or email depending on settings (see contact sharing).
$md$,
  'client', 10, ARRAY['client-how-booking-works', 'client-contact-sharing', 'client-accept-quote']
),
(
  'c1111111-1111-4111-8111-111111111104',
  'client-contact-sharing',
  'Contact sharing after payment',
  'When phone and email can be shared to coordinate.',
  $md$
## Before payment

Until a booking is paid, Eventtz often masks phone and email so both sides coordinate through Messages.

### After payment

Once the booking is paid (or in later paid states), contact details may become visible so you can coordinate off-platform. Venue address on the booking is for the vendor when you have provided it.

### Your preferences

Under **Settings**, review contact sharing preferences (email, phone, and related options). Change them if you want stricter sharing.

If something looks wrong on a paid booking, message the vendor in-app first, then use **Contact** if you need Eventtz.
$md$,
  'client', 20, ARRAY['client-messaging-vendors', 'client-account-settings', 'client-when-do-i-pay']
),

-- ========== CLIENT: problems ==========
(
  'c1111111-1111-4111-8111-111111111105',
  'client-report-problem',
  'What if something goes wrong?',
  'Report a problem from your booking. We may pause payout.',
  $md$
## Open a dispute

If the event had a serious problem (no-show, major quality issue, safety concern):

1. Open the booking under **Bookings**.
2. Choose to **report a problem** / open a dispute.
3. Or go to **Disputes** in the sidebar and follow the prompts.
4. Describe what happened clearly and attach evidence if you can.

### What Eventtz does

We review the case and may **pause payment** to the vendor until it is sorted. Check the dispute thread for updates.

### What not to use disputes for

- Simple questions about how the product works (use Help or **Contact**)
- Changing your mind before the event when cancel/refund still applies (use cancel)

For money or ban questions the Help assistant may send you to **Contact** on purpose.
$md$,
  'client', 10, ARRAY['client-contact-support', 'client-payment-safe', 'client-cancel-refund']
),
(
  'c1111111-1111-4111-8111-111111111105',
  'client-contact-support',
  'Contact Eventtz support',
  'Reach the team via Contact for account and money issues.',
  $md$
## Contact

Open **Contact** in the portal to send a message to Eventtz.

### Include

- Your account email
- Booking ID for booking or payment issues
- Clear description and screenshots if useful

We aim to reply by email within about **two working days**.

### Help vs Contact

- Use this Help Center (browse or ask the assistant) for how-to questions.
- Use **Contact** for account problems, payment failures, or anything the assistant escalates.
- Use **Disputes** for problems with a paid or completed event.
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

Every vendor completes an onboarding profile. Our team reviews each listing before it goes live on Browse.

### What you can check yourself

- Ratings and written reviews
- Completed booking signals on the profile
- Portfolio and credentials the vendor uploaded

Vetting reduces risk. It does not replace reading the profile and agreeing details in chat before you pay.
$md$,
  'client', 30, ARRAY['client-browse-vendors', 'client-how-booking-works', 'client-leave-review']
),

-- ========== CLIENT: account ==========
(
  'c1111111-1111-4111-8111-111111111106',
  'client-password-reset',
  'Resetting your password',
  'Use Forgot password on the sign-in page for a one-click email link.',
  $md$
## If you are signed out

1. Open **Client login**.
2. Choose **Forgot password**.
3. Enter the email for your account.
4. Open the reset link we email you (usually valid for about **one hour**).
5. Choose a new password and sign in.

### If you are signed in

Open **Settings** and change your password there.

### Tips

- Check spam if the email is slow.
- Request a new link if the old one expired.
- Use **Contact** if you no longer have access to the email inbox.
$md$,
  'client', 10, ARRAY['client-account-settings', 'client-create-account']
),
(
  'c1111111-1111-4111-8111-111111111106',
  'client-account-settings',
  'Account settings',
  'Preferred name, password, and sharing preferences.',
  $md$
## Settings

Open **Settings** in the client portal.

### Common options

- **Preferred name**: shown to vendors on bookings
- **Password**: change while signed in
- **Contact sharing**: control email/phone sharing rules
- Legal and account links as shown in the page

### Notifications

Check **Notifications** in the sidebar for booking updates, messages, and reminders. Keep your email up to date so you do not miss accept or pay prompts.
$md$,
  'client', 20, ARRAY['client-password-reset', 'client-contact-sharing', 'client-create-account']
),

-- ========== VENDOR: join ==========
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-how-to-join',
  'How do I join Eventtz?',
  'Register, complete your profile, submit for review. Stripe comes later.',
  $md$
## Join Eventtz as a vendor

1. Open **Vendor register** and create your account.
2. Sign in and open **Profile** (onboarding wizard).
3. Complete each profile step (business basics, services, location, pricing, media, credentials, policies, review).
4. **Submit for review**.

### Important: Stripe is not required to finish setup

You do **not** need to connect Stripe to submit your profile or to become discoverable after approval. Connect payouts when you are ready to **accept** your first booking (or anytime under **Payments**).

### After you submit

Our team reviews your listing. When you are approved, clients can find you on Browse.
$md$,
  'vendor', 10, ARRAY['vendor-onboarding-steps', 'vendor-when-live', 'vendor-stripe-payouts']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-onboarding-steps',
  'Vendor onboarding steps',
  'Walk through Profile steps and submit for review.',
  $md$
## Profile wizard

Open **Profile** and complete the steps in order. Save as you go.

### Typical steps

1. Business basics and contact
2. Services you offer
3. Location and travel
4. Pricing and packages
5. Portfolio media and certificates
6. Policies
7. Final review and **submit**

### While pending approval

Some fields may stay locked until review finishes. If we need changes, we will tell you.

### After approval

You can edit your live listing from **Profile**. Keep packages and photos up to date so enquiries convert.
$md$,
  'vendor', 20, ARRAY['vendor-how-to-join', 'vendor-when-live', 'vendor-edit-profile']
),

-- ========== VENDOR: go live & payouts ==========
(
  'b1111111-1111-4111-8111-111111111102',
  'vendor-when-live',
  'When will my profile go live?',
  'After you submit and our team approves your profile.',
  $md$
## Going live

Your profile goes live on Browse after:

1. You finish onboarding and **submit**
2. Our team **approves** your profile

### Stripe timing

Stripe Connect is **not** a gate for going live. You can be approved and discoverable first. You will need Stripe charges and payouts enabled before you can **accept** a booking.

### Where to check status

Look at **Profile** and **Dashboard** for approval status and any payout reminders.
$md$,
  'vendor', 10, ARRAY['vendor-stripe-payouts', 'vendor-how-to-join', 'vendor-edit-profile']
),
(
  'b1111111-1111-4111-8111-111111111102',
  'vendor-stripe-payouts',
  'Connect Stripe and get paid',
  'Complete payout setup before you accept bookings.',
  $md$
## Connect Stripe

Open **Payments** in the vendor portal, or follow the prompt when you try to **accept** a booking.

### Steps

1. Start Stripe Connect Express onboarding.
2. Complete Stripe’s identity and bank details flow.
3. Return to Eventtz. Wait until **charges** and **payouts** show as enabled.

### Why it matters

You cannot accept a client booking until payouts are ready. That protects you and the client so funds can move after the event.

### After a paid event

When completion rules are met (or auto-release ~48 hours after the event with no dispute), funds go to your connected Stripe account on Stripe’s payout schedule.
$md$,
  'vendor', 20, ARRAY['vendor-when-get-paid', 'vendor-accept-booking', 'vendor-no-cut']
),

-- ========== VENDOR: bookings ==========
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-accept-booking',
  'Accepting or declining enquiries',
  'Respond from Bookings once payouts are ready.',
  $md$
## Respond to an enquiry

1. Open **Bookings**.
2. Open the pending enquiry.
3. Read the date, location, packages, and client notes.
4. Chat if you need clarity.
5. **Accept** or **Decline**.

### If Stripe is not ready

Eventtz will ask you to finish Connect first, then return to accept.

### After you accept

The client can pay. Keep an eye on **Messages** and **Notifications** for payment and logistics.

### Reply quickly

Faster replies win more bookings. We may send reminder notifications if an enquiry is waiting.
$md$,
  'vendor', 10, ARRAY['vendor-stripe-payouts', 'vendor-price-update', 'vendor-messages-clients']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-price-update',
  'Updating the price on a booking',
  'Send charges or discounts while the booking is pending.',
  $md$
## Price updates

On a pending booking you can send an updated price (extras or discounts).

### Steps

1. Open the booking.
2. Create the price update with clear line items.
3. Send it to the client.
4. Wait for the client to **accept** or **decline** the update.

The client pays only after the agreed total is accepted and you have accepted the booking (when those steps apply).

Use chat to explain why the price changed so the client is not surprised.
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

From a message thread you can send a **custom quote** with event details and a package price.

### What it does

That creates a booking the client can review, accept, and pay (after your accept flow as required).

### When to use it

- A client messaged you without a full enquiry form
- You agreed a bespoke package in chat
- You want a clean total on a booking instead of only chat text

Keep the quote accurate. Price updates can still follow if details change.
$md$,
  'vendor', 30, ARRAY['vendor-accept-booking', 'vendor-price-update', 'vendor-messages-clients']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-complete-cancel',
  'Completing or cancelling a booking',
  'Confirm completion after paid events. Cancel when the status allows.',
  $md$
## After a paid event

1. Open the booking.
2. Confirm **completion** when the work is done.
3. The client should confirm too when prompted.

If nobody disputes, payout can release about **48 hours** after the event.

## Cancelling

Use cancel on the booking when the status allows it. Rules differ for unpaid enquiries vs paid bookings. Check the actions on that booking.

If the client had already paid and a refund is due, Eventtz handles refund flows according to the booking state. Use **Contact** if something looks stuck.
$md$,
  'vendor', 40, ARRAY['vendor-when-get-paid', 'vendor-dispute', 'vendor-accept-booking']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-messages-clients',
  'Messaging clients',
  'Use Messages and booking chat to agree details before pay.',
  $md$
## Messages

Open **Messages** for DM threads with clients. Booking-linked chat keeps the conversation next to that enquiry.

### Good habits

- Answer enquiries quickly
- Confirm date, venue, and package in writing
- Send price updates on the booking when money changes
- After payment, use shared contact details only as allowed by the booking stage

Unread counts appear in the portal so you do not miss replies.
$md$,
  'vendor', 50, ARRAY['vendor-accept-booking', 'vendor-custom-quote', 'vendor-contact-support']
),

-- ========== VENDOR: earnings ==========
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-no-cut',
  'Does Eventtz take a cut from my earnings?',
  'No. Clients pay the service fee on top of your quote.',
  $md$
## Fees

Eventtz does **not** take a cut from your agreed quote.

Clients pay a **5% service fee** on top of what you agreed. You keep the vendor amount shown on the booking.

### Example

If your quote is £400, the client pays £400 plus the 5% fee at checkout. Your earnings target for that booking is the £400 (subject to Stripe and any dispute outcome).
$md$,
  'vendor', 10, ARRAY['vendor-when-get-paid', 'vendor-stripe-payouts']
),
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-when-get-paid',
  'When do I get paid?',
  'After completion confirmation or automatic release about 48h post-event.',
  $md$
## Timing

1. Client pays after you accept. Eventtz holds the funds.
2. After the event, you and/or the client confirm completion.
3. If there is no problem, funds can also release automatically about **48 hours** after the event.
4. Stripe then pays out to your bank on Stripe’s schedule.

### Delays

- Open dispute or support hold
- Incomplete Stripe onboarding
- Bank or Stripe verification issues

Check **Payments** and the booking payment status. Use **Contact** with the booking ID if payout is overdue after release.
$md$,
  'vendor', 20, ARRAY['vendor-no-cut', 'vendor-dispute', 'vendor-stripe-payouts']
),

-- ========== VENDOR: disputes ==========
(
  'b1111111-1111-4111-8111-111111111105',
  'vendor-dispute',
  'What happens if there is a dispute?',
  'Either side can report a problem. Payout may be held.',
  $md$
## Disputes

You or the client can report a problem from the booking. Eventtz reviews it and may **hold payment** until it is sorted.

### What you should do

1. Open **Disputes** or the booking dispute section.
2. Respond promptly with facts and evidence.
3. Stay professional in the thread.

### Outcomes

Our team may resolve with no change, a partial refund, or other actions depending on the case. You will see notes on the dispute when available.

Do not try to settle serious money disputes only off-platform. Keep the record in Eventtz.
$md$,
  'vendor', 10, ARRAY['vendor-contact-support', 'vendor-when-get-paid', 'vendor-complete-cancel']
),
(
  'b1111111-1111-4111-8111-111111111105',
  'vendor-contact-support',
  'Contact Eventtz support',
  'Use Contact for account, payout, and listing questions.',
  $md$
## Contact

Open **Contact** in the vendor portal.

### Include

- Account email
- Booking ID for payout or dispute questions
- Screenshots for Stripe or checkout errors

We aim to reply by email within about **two working days**.

Use Help articles or the assistant for how-to questions first. Use **Disputes** for active booking problems.
$md$,
  'vendor', 20, ARRAY['vendor-dispute', 'vendor-stripe-payouts']
),

-- ========== VENDOR: profile & analytics ==========
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-edit-profile',
  'Editing your live profile',
  'Update services, portfolio, and availability after approval.',
  $md$
## Live edits

Once approved, open **Profile** to update your listing.

### Keep current

- Packages and prices
- Photos and portfolio files
- Service area and travel
- Policies and availability notes

Save changes as you go. Major changes may still be reviewed if our team needs to check them.

A clear, complete profile gets more enquiries and faster accepts from clients.
$md$,
  'vendor', 10, ARRAY['vendor-analytics', 'vendor-when-live', 'vendor-onboarding-steps']
),
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-analytics',
  'Vendor analytics',
  'See how enquiries convert on Analytics.',
  $md$
## Analytics

Open **Analytics** to see marketplace funnel stats for your profile over a period.

### Useful signals

- Profile views
- Enquiries
- Accepts and outcomes
- Reply-time related metrics when shown

### How to improve

- Reply to enquiries faster
- Keep packages clear and priced fairly
- Refresh portfolio photos
- Complete Stripe so you never block an accept

Use Dashboard attention items together with Analytics to catch unpaid accepts and payout setup reminders.
$md$,
  'vendor', 20, ARRAY['vendor-edit-profile', 'vendor-accept-booking', 'vendor-stripe-payouts']
)
ON CONFLICT (slug) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  body_md = EXCLUDED.body_md,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order,
  related_slugs = EXCLUDED.related_slugs,
  published = true,
  updated_at = now();
