-- Plain-English Help Center copy (lay terms, no jargon). Upsert by slug.
-- Run after 051–053.

UPDATE public.help_categories
SET
  description = CASE slug
    WHEN 'vendor-go-live' THEN 'Approval first. Set up how you get paid before you accept bookings.'
    WHEN 'admin-team-audit' THEN 'Admin team (super admin) and activity history.'
    WHEN 'admin-commerce-bookings' THEN 'Find bookings and run support payment actions.'
    WHEN 'admin-commerce-insights' THEN 'Money summary and marketplace stats.'
    ELSE description
  END,
  updated_at = now()
WHERE slug IN ('vendor-go-live', 'admin-team-audit', 'admin-commerce-bookings', 'admin-commerce-insights');

INSERT INTO public.help_articles (category_id, slug, title, summary, body_md, audience, sort_order, related_slugs)
VALUES
(
  'c1111111-1111-4111-8111-111111111101',
  'client-create-account',
  'Create a client account',
  'Sign up and open your portal.',
  $md$
## Create your account

1. Tap **Client register** on Eventtz.
2. Enter your email and choose a password.
3. If we ask you to confirm your email, follow the link we send.
4. Sign in. You will see your **Dashboard**.

### Your first visits

We may ask for a **preferred name**. Vendors see this name on your bookings instead of your email. You can change it later in **Settings**.

### What to do next

1. Open **Browse** to find vendors.
2. Save people you like with the heart (**Favourites**).
3. Send a request when you are ready to book.
$md$,
  'client', 5, ARRAY['client-browse-vendors','client-account-settings','client-password-reset']
),
(
  'c1111111-1111-4111-8111-111111111101',
  'client-browse-vendors',
  'How to browse and find vendors',
  'Search by what you need, where, and when.',
  $md$
## Open Browse

In your client area, open **Browse**. This is where approved vendors are listed.

### Search and filters

You can:

- Type what you need in plain words (for example "catering in Manchester for 80 guests")
- Filter by type (baking, catering, photography, makeup, rentals, and more)
- Set place, dates, and budget when those options are shown

### Before you send a request

Open a vendor to check:

- Packages and prices
- Photos and past work
- Reviews from other clients
- How quickly they usually reply

### Tips

- Tap the heart to save vendors you like
- If dates look busy, still ask. The vendor can confirm in chat
- Compare a few people before you pay anyone
$md$,
  'client', 10, ARRAY['client-favourites','client-how-booking-works','client-are-vendors-vetted']
),
(
  'c1111111-1111-4111-8111-111111111101',
  'client-favourites',
  'Saving vendors to Favourites',
  'Keep a shortlist while you compare.',
  $md$
## Favourites

Tap the **heart** on a vendor to save them. Open **Favourites** anytime to see your list.

### Why use it

- Compare people without losing them in search
- Ask several saved vendors the same question at once
- Come back later if you are still deciding

Favourites stay with your signed-in account. Removing a favourite does not cancel a booking you already started.
$md$,
  'client', 20, ARRAY['client-browse-vendors','client-multi-enquire']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-how-booking-works',
  'How does booking work?',
  'Ask, agree, pay after they say yes, then confirm after the event.',
  $md$
## Step by step

### 1. Choose a vendor

Browse profiles, check packages and reviews, then open the person you want.

### 2. Send a request

Add your date (and address or postcode if you have it). Pick packages if asked. Send the request.

You can track it under **Bookings**.

### 3. Chat and agree

Use **Messages** to agree details and price. The vendor may send a new price. Accept or decline it from the booking.

### 4. Vendor says yes

When they accept, you can pay. You do **not** pay before that.

### 5. Pay

Open the booking and pay. You will see the full total, including the Eventtz fee, before you confirm.

### 6. Plan the day

After you pay, keep chatting (and share phone or email if Eventtz shows them) to finalise plans.

### 7. After the event

If it went well, confirm it is complete so the vendor can be paid. If something went wrong, report a problem instead.
$md$,
  'client', 10, ARRAY['client-when-do-i-pay','client-complete-booking','client-cancel-refund']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-multi-enquire',
  'Asking several vendors at once',
  'Send the same brief to more than one vendor.',
  $md$
## Ask more than one vendor

Use this when you want options before you choose.

### Steps

1. On **Browse** or **Favourites**, select more than one vendor.
2. Open the multi-ask flow and fill one shared brief (date, place, notes).
3. Send. Each vendor gets their own request with that brief.

### What happens next

- Chat with each vendor separately
- Compare replies and prices
- Pay only the one you choose after they accept
- Cancel or leave the others when you no longer need them

You are not charged to ask. You only pay after a vendor accepts and you complete payment on that booking.
$md$,
  'client', 20, ARRAY['client-how-booking-works','client-browse-vendors','client-favourites']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-accept-quote',
  'Accepting or declining a price',
  'Respond to a new quote or price change.',
  $md$
## New prices

While you are still deciding, a vendor may:

- Send a custom quote from chat
- Send a price update (extras or a discount)

### What you should do

1. Open the booking under **Bookings**.
2. Read the new total carefully.
3. **Accept** if you agree, or **Decline** if you do not.

### Before you pay

You only pay after you and the vendor agree the price, and they have accepted the booking.

If you decline, keep chatting or cancel that request if you are done with that vendor.
$md$,
  'client', 30, ARRAY['client-how-booking-works','client-when-do-i-pay','client-messaging-vendors']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-cancel-refund',
  'Cancelling and refunds',
  'Cancel before the vendor is paid for a full refund.',
  $md$
## When you can cancel

Open the booking and use **Cancel** when it is allowed. Common cases:

- You asked but the vendor has not accepted yet
- They accepted but you have not paid yet
- You paid, but money has not been released to the vendor yet

### If you already paid

If you cancel before the vendor is paid, you get a **full refund** to your card. Banks often take **5 to 10 working days** to show it.

### After the event

Do not use cancel for a problem after the day. Open a **dispute** from the booking so we can pause paying the vendor and help.

### If the vendor cancels

If they cancel after you paid, we refund you. Use **Contact** if something looks wrong.
$md$,
  'client', 40, ARRAY['client-report-problem','client-when-do-i-pay','client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-complete-booking',
  'Confirming the event went well',
  'Say the day went fine so the vendor can be paid.',
  $md$
## After the event

If things went well:

1. Open the booking under **Bookings**.
2. Confirm it is complete when asked.
3. The vendor should confirm on their side too.

### Automatic payment

If nobody reports a problem, money can go to the vendor about **48 hours** after the event.

### If something went wrong

Do not confirm. Open a **dispute** from the booking so we can hold the money and review.

### Reviews

After a successful booking you may be asked to leave a review. Honest reviews help other clients.
$md$,
  'client', 50, ARRAY['client-how-booking-works','client-payment-safe','client-leave-review']
),
(
  'c1111111-1111-4111-8111-111111111102',
  'client-leave-review',
  'Leaving a review',
  'Rate a vendor after a finished booking.',
  $md$
## Reviews

After a completed booking, we may ask you to leave a review.

### Tips

- Be fair and specific (timing, quality, communication)
- Reviews help other clients and good vendors
- If you have an open dispute, sort that first

You may find past reviews under **Settings** when that section is shown.
$md$,
  'client', 60, ARRAY['client-complete-booking','client-are-vendors-vetted']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-when-do-i-pay',
  'When do I pay?',
  'After the vendor accepts. You see the full total first.',
  $md$
## Timing

You pay **after the vendor accepts**. Asking does not cost anything.

### How to pay

1. Open the accepted booking under **Bookings**.
2. Tap **Pay**.
3. Check the full total (packages, agreed changes, and the Eventtz fee).
4. Pay securely on the payment page.

### After you pay

We hold the money until the event is done (see “Is my payment safe?”).

If payment fails, try again from the same booking or use **Contact** and include the booking ID.
$md$,
  'client', 10, ARRAY['client-service-fee','client-payment-safe','client-how-booking-works']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-service-fee',
  'Is there a service fee?',
  'Yes. 5%, shown before you pay.',
  $md$
## Service fee

Eventtz adds a **5% fee** on top of the vendor’s agreed price.

### What you see

Before you pay you always see:

- Vendor amount
- Service fee
- **Total** you pay

There are no surprise extras beyond what the booking already shows.

### What vendors keep

Vendors keep the price you agreed. The fee is paid by you on top. We do not take a cut out of the vendor’s quote.
$md$,
  'client', 20, ARRAY['client-when-do-i-pay','client-payment-safe']
),
(
  'c1111111-1111-4111-8111-111111111103',
  'client-payment-safe',
  'Is my payment safe?',
  'We hold your money until the event is done.',
  $md$
## How we protect your payment

When you pay, Eventtz holds the money. The vendor is not paid the moment you pay.

### When the vendor gets paid

Money can be released when:

- You and the vendor both say the event went well, or
- About **48 hours** after the event if nobody reports a problem

### If there is a problem

Report it from the booking (**Disputes**). We can pause paying the vendor while we look into it.

### Card payments

You pay on a secure payment page. Eventtz does not keep your full card number.
$md$,
  'client', 30, ARRAY['client-report-problem','client-complete-booking','client-cancel-refund']
),
(
  'c1111111-1111-4111-8111-111111111104',
  'client-messaging-vendors',
  'Messaging vendors',
  'Chat from a profile or from your booking.',
  $md$
## Where to chat

- Open **Messages** for all chats
- Start chat from a vendor profile
- Open chat from a booking so it stays linked to that event

### What to talk about

- Dates, guest numbers, venue
- Packages and extras
- Price changes (confirm them on the booking when asked)

### Tip

Keep important agreements in Eventtz chat or on the booking so both sides have a record.
$md$,
  'client', 10, ARRAY['client-how-booking-works','client-contact-sharing','client-accept-quote']
),
(
  'c1111111-1111-4111-8111-111111111104',
  'client-contact-sharing',
  'Sharing phone and email',
  'When details can be shared after you pay.',
  $md$
## Before you pay

Until you pay, phone and email are often hidden so you chat inside Eventtz.

### After you pay

Once you have paid, contact details may become visible so you can coordinate by phone or email. Venue details you added on the booking are for the vendor when you provided them.

### Your settings

Under **Settings**, check sharing preferences. Change them if you want stricter sharing.
$md$,
  'client', 20, ARRAY['client-messaging-vendors','client-account-settings','client-when-do-i-pay']
),
(
  'c1111111-1111-4111-8111-111111111105',
  'client-report-problem',
  'What if something goes wrong?',
  'Report a problem from your booking. We may pause paying the vendor.',
  $md$
## Report a problem

If something serious went wrong (no-show, major quality issue, safety concern):

1. Open the booking under **Bookings**.
2. Choose to report a problem / open a dispute.
3. Or go to **Disputes** in the menu.
4. Explain what happened and add photos if you can.

### What we do

We review the case and may **pause paying the vendor** until it is sorted. Check the dispute for updates.

### What disputes are not for

- Simple how-to questions (use Help or **Contact**)
- Changing your mind before the event when cancel still works (use cancel)
$md$,
  'client', 10, ARRAY['client-contact-support','client-payment-safe','client-cancel-refund']
),
(
  'c1111111-1111-4111-8111-111111111105',
  'client-contact-support',
  'Contact Eventtz support',
  'Send a message for account and money issues.',
  $md$
## Contact

Open **Contact** in your portal to message Eventtz.

### Include

- Your account email
- Booking ID for booking or payment issues
- A clear description (and screenshots if useful)

We aim to reply by email within about **two working days**.

### Help vs Contact vs Disputes

- Use Help for how-to questions
- Use **Contact** for account problems or payment failures
- Use **Disputes** for problems with a paid or finished event
$md$,
  'client', 20, ARRAY['client-report-problem','client-are-vendors-vetted']
),
(
  'c1111111-1111-4111-8111-111111111105',
  'client-are-vendors-vetted',
  'Are vendors checked?',
  'Every vendor finishes setup and is reviewed before going live.',
  $md$
## Our checks

Every vendor completes a profile. Our team reviews each listing before it appears on Browse.

### What you can check yourself

- Ratings and written reviews
- Signs of completed bookings on the profile
- Photos and credentials the vendor added

Checks reduce risk. You should still read the profile and agree details in chat before you pay.
$md$,
  'client', 30, ARRAY['client-browse-vendors','client-how-booking-works','client-leave-review']
),
(
  'c1111111-1111-4111-8111-111111111106',
  'client-password-reset',
  'Resetting your password',
  'Use Forgot password on the sign-in page.',
  $md$
## If you are signed out

1. Open **Client login**.
2. Choose **Forgot password**.
3. Enter your email.
4. Open the link we email you (usually valid for about **one hour**).
5. Choose a new password and sign in.

### If you are signed in

Open **Settings** and change your password there.

### Tips

- Check spam if the email is slow
- Request a new link if the old one expired
- Use **Contact** if you cannot access that email inbox
$md$,
  'client', 10, ARRAY['client-account-settings','client-create-account']
),
(
  'c1111111-1111-4111-8111-111111111106',
  'client-account-settings',
  'Account settings',
  'Preferred name, password, and sharing preferences.',
  $md$
## Settings

Open **Settings** in the client area.

### Common options

- **Preferred name**: shown to vendors on bookings
- **Password**: change while signed in
- **Contact sharing**: control email and phone sharing
- Legal links as shown on the page

### Notifications

Check **Notifications** for booking updates and messages. Keep your email up to date so you do not miss pay prompts.
$md$,
  'client', 20, ARRAY['client-password-reset','client-contact-sharing','client-create-account']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-how-to-join',
  'How do I join Eventtz?',
  'Create your profile and submit for review. Bank setup comes later.',
  $md$
## Join as a vendor

1. Open **Vendor register** and create your account.
2. Sign in and open **Profile**.
3. Complete each step (business basics, services, place, prices, photos, policies, review).
4. **Submit for review**.

### Bank setup is not needed to finish your profile

You do **not** need to set up payments to submit or to appear on Browse after approval. Set up how you get paid when you are ready to **accept** your first booking (or anytime under **Payments**).

### After you submit

Our team reviews your listing. When you are approved, clients can find you on Browse.
$md$,
  'vendor', 10, ARRAY['vendor-onboarding-steps','vendor-when-live','vendor-stripe-payouts']
),
(
  'b1111111-1111-4111-8111-111111111101',
  'vendor-onboarding-steps',
  'Vendor profile steps',
  'Complete Profile and submit for review.',
  $md$
## Profile steps

Open **Profile** and finish each step. Save as you go.

### Typical steps

1. Business basics and contact
2. Services you offer
3. Location and travel
4. Pricing and packages
5. Photos and certificates
6. Policies
7. Final review and **submit**

### While waiting for approval

Some fields may stay locked until review finishes. We will tell you if we need changes.

### After approval

Edit your live listing from **Profile**. Keep packages and photos up to date.
$md$,
  'vendor', 20, ARRAY['vendor-how-to-join','vendor-when-live','vendor-edit-profile']
),
(
  'b1111111-1111-4111-8111-111111111102',
  'vendor-when-live',
  'When will my profile go live?',
  'After you submit and our team approves you.',
  $md$
## Going live

Your profile goes live on Browse after:

1. You finish setup and **submit**
2. Our team **approves** your profile

### Getting paid

Setting up getting paid is **not** required to go live. You can be approved first. You will need how you get paid finished before you can **accept** a booking.

### Where to check

Look at **Profile** and **Dashboard** for approval status and any payment reminders.
$md$,
  'vendor', 10, ARRAY['vendor-stripe-payouts','vendor-how-to-join','vendor-edit-profile']
),
(
  'b1111111-1111-4111-8111-111111111102',
  'vendor-stripe-payouts',
  'Set up how you get paid',
  'Finish how you get paid before you accept bookings.',
  $md$
## Set up how you get paid

Open **Payments**, or follow the prompt when you try to **accept** a booking.

### Steps

1. Start how you get paid.
2. Complete the identity and bank details steps with our payments partner.
3. Return to Eventtz and wait until setup shows as ready.

### Why it matters

You cannot accept a client booking until how you get paid is ready. That way money can move safely after the event.

### After a paid event

When everyone confirms (or about **48 hours** after the event with no problem), money goes to your bank on the payments partner’s schedule.
$md$,
  'vendor', 20, ARRAY['vendor-when-get-paid','vendor-accept-booking','vendor-no-cut']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-accept-booking',
  'Accepting or declining requests',
  'Respond from Bookings once getting paid is set up.',
  $md$
## Respond to a request

1. Open **Bookings**.
2. Open the pending request.
3. Read the date, place, packages, and notes.
4. Chat if you need clarity.
5. **Accept** or **Decline**.

### If how you get paid is not ready

Eventtz will ask you to finish bank setup first, then come back to accept.

### After you accept

The client can pay. Watch **Messages** and **Notifications**.

### Reply quickly

Faster replies win more bookings. We may remind you if a request is waiting.
$md$,
  'vendor', 10, ARRAY['vendor-stripe-payouts','vendor-price-update','vendor-messages-clients']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-price-update',
  'Updating the price',
  'Send extras or discounts while the booking is pending.',
  $md$
## Price updates

On a pending booking you can send a new price (extras or discounts).

### Steps

1. Open the booking.
2. Create the update with clear line items.
3. Send it to the client.
4. Wait for them to **accept** or **decline**.

The client pays only after the agreed total is accepted and you have accepted the booking (when those steps apply).

Explain price changes in chat so the client is not surprised.
$md$,
  'vendor', 20, ARRAY['vendor-custom-quote','vendor-accept-booking']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-custom-quote',
  'Sending a custom quote from Messages',
  'Create a booking quote for a client from chat.',
  $md$
## Custom quotes

From a message thread you can send a **custom quote** with event details and a price.

### What it does

It creates a booking the client can review, accept, and pay.

### When to use it

- A client messaged you without a full request form
- You agreed a bespoke package in chat
- You want a clear total on a booking, not only chat text
$md$,
  'vendor', 30, ARRAY['vendor-accept-booking','vendor-price-update','vendor-messages-clients']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-complete-cancel',
  'Completing or cancelling a booking',
  'Confirm after paid events. Cancel when the booking allows it.',
  $md$
## After a paid event

1. Open the booking.
2. Confirm **completion** when the work is done.
3. The client should confirm too when asked.

If nobody reports a problem, money can be released about **48 hours** after the event.

## Cancelling

Use cancel on the booking when it is allowed. Rules differ for unpaid requests vs paid bookings. Check the buttons on that booking.

If the client had already paid and a refund is due, Eventtz handles the refund for that booking state. Use **Contact** if something looks stuck.
$md$,
  'vendor', 40, ARRAY['vendor-when-get-paid','vendor-dispute','vendor-accept-booking']
),
(
  'b1111111-1111-4111-8111-111111111103',
  'vendor-messages-clients',
  'Messaging clients',
  'Use Messages and booking chat to agree details.',
  $md$
## Messages

Open **Messages** for chats with clients. Booking chat keeps the conversation next to that request.

### Good habits

- Answer requests quickly
- Confirm date, venue, and package in writing
- Send price updates on the booking when money changes
- After payment, use shared contact details only when Eventtz shows them

Unread counts appear in the menu so you do not miss replies.
$md$,
  'vendor', 50, ARRAY['vendor-accept-booking','vendor-custom-quote','vendor-contact-support']
),
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-no-cut',
  'Does Eventtz take a cut from my earnings?',
  'No. Clients pay the fee on top of your quote.',
  $md$
## Fees

Eventtz does **not** take a cut from your agreed quote.

Clients pay a **5% fee** on top of what you agreed. You keep the vendor amount shown on the booking.

### Example

If your quote is £400, the client pays £400 plus the 5% fee. Your earnings for that booking are the £400 (unless a dispute changes the outcome).
$md$,
  'vendor', 10, ARRAY['vendor-when-get-paid','vendor-stripe-payouts']
),
(
  'b1111111-1111-4111-8111-111111111104',
  'vendor-when-get-paid',
  'When do I get paid?',
  'After both sides confirm, or about 48 hours after the event if all is fine.',
  $md$
## Timing

1. The client pays after you accept. Eventtz holds the money.
2. After the event, you and/or the client confirm it went well.
3. If there is no problem, money can also release about **48 hours** after the event.
4. Then money goes to your bank on the payments partner’s schedule.

### Delays

- An open dispute or paused payment
- Incomplete how you get paid
- Bank checks still in progress

Check **Payments** and the booking. Use **Contact** with the booking ID if money is late after it should have been released.
$md$,
  'vendor', 20, ARRAY['vendor-no-cut','vendor-dispute','vendor-stripe-payouts']
),
(
  'b1111111-1111-4111-8111-111111111105',
  'vendor-dispute',
  'What happens if there is a dispute?',
  'Either side can report a problem. Payment may be held.',
  $md$
## Disputes

You or the client can report a problem from the booking. Eventtz reviews it and may **hold payment** until it is sorted.

### What you should do

1. Open **Disputes** or the booking dispute section.
2. Reply quickly with facts and evidence.
3. Stay professional in the thread.

### Outcomes

Our team may leave things as they are, issue a partial refund, or take other actions depending on the case. You will see notes on the dispute when available.

Keep serious money issues in Eventtz so there is a clear record.
$md$,
  'vendor', 10, ARRAY['vendor-contact-support','vendor-when-get-paid','vendor-complete-cancel']
),
(
  'b1111111-1111-4111-8111-111111111105',
  'vendor-contact-support',
  'Contact Eventtz support',
  'Use Contact for account and payment questions.',
  $md$
## Contact

Open **Contact** in the vendor area.

### Include

- Account email
- Booking ID for payment or dispute questions
- Screenshots for payment setup errors

We aim to reply by email within about **two working days**.

Use Help for how-to questions first. Use **Disputes** for active booking problems.
$md$,
  'vendor', 20, ARRAY['vendor-dispute','vendor-stripe-payouts']
),
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-edit-profile',
  'Editing your live profile',
  'Update services, photos, and availability after approval.',
  $md$
## Live edits

Once approved, open **Profile** to update your listing.

### Keep current

- Packages and prices
- Photos
- Service area and travel
- Policies and availability notes

Save as you go. Big changes may still be reviewed if our team needs to check them.
$md$,
  'vendor', 10, ARRAY['vendor-analytics','vendor-when-live','vendor-onboarding-steps']
),
(
  'b1111111-1111-4111-8111-111111111106',
  'vendor-analytics',
  'Vendor analytics',
  'See how requests turn into bookings.',
  $md$
## Analytics

Open **Analytics** to see how your profile is doing over a period.

### Useful numbers

- Profile views
- Requests
- Accepts and outcomes
- Reply-time style metrics when shown

### How to improve

- Reply faster
- Keep packages clear and fairly priced
- Refresh photos
- Finish how you get paid so you never block an accept

Use Dashboard reminders together with Analytics to catch unpaid accepts and how you get paid.
$md$,
  'vendor', 20, ARRAY['vendor-edit-profile','vendor-accept-booking','vendor-stripe-payouts']
),
(
  'a1111111-1111-4111-8111-111111111101',
  'admin-sign-in-console',
  'Sign in and use the admin console',
  'Open the console, move around, and sign out.',
  $md$
## Sign in

1. Go to **/admin/login**.
2. Sign in with an admin account.
3. You land on the **Dashboard**.

## Layout

- Side menu (or mobile menu): Dashboard, Commerce, Directory, Messages, Blog, Trust & safety, Team, Activity log
- **Email testing** only shows for **super admins**
- Your label shows **Support admin** or **Super admin**

## Sign out

Use **Sign out**. You return to the admin login.

## Help

Use the **?** button for guides and the admin assistant.
$md$,
  'admin', 10, ARRAY['admin-roles-explained','admin-dashboard-overview']
),
(
  'a1111111-1111-4111-8111-111111111101',
  'admin-roles-explained',
  'Support admin vs super admin',
  'What each role can see and change.',
  $md$
## Support admin

Can:

- View dashboard, bookings lists, money summary, and marketplace stats
- Approve, set pending, or ban vendors; suspend or restore clients
- Handle disputes (status, assign, notes); hide or show reviews
- Use Messages and Blog
- Read Team list and Activity log

Cannot:

- Run booking money recovery actions
- Finish disputes with refunds or paying the vendor
- Invite or change admin team roles
- Open Email testing
- Download the financials spreadsheet (restricted to super admins)

## Super admin

Everything a support admin can do, plus:

- Booking support actions (check payment, pay vendor, pause payment, cancel, mark complete)
- Dispute money outcomes (pay vendor, full refund, partial refund)
- Team invite / role / suspend
- Email testing
- Financials download when available

Money and team changes are recorded in the **Activity log**.
$md$,
  'admin', 20, ARRAY['admin-sign-in-console','admin-booking-support-actions','admin-resolve-dispute-money']
),
(
  'a1111111-1111-4111-8111-111111111101',
  'admin-dashboard-overview',
  'Dashboard at a glance',
  'Key numbers, things that need attention, and charts.',
  $md$
## Open Dashboard

Go to **/admin/dashboard**.

## What you see

- Key numbers such as pending vendor approvals, active bookings, and paid bookings
- **Needs attention**: pending vendors, open disputes, bookings needing help
- Charts for signups and bookings (pick a time range such as 7 or 30 days)

## How to use it

Tap attention items to jump into Directory, Trust, or Commerce. Start each shift here so you do not miss approvals or open disputes.
$md$,
  'admin', 30, ARRAY['admin-approve-vendors','admin-find-bookings','admin-triage-disputes']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-approve-vendors',
  'Review and approve vendors',
  'Directory Vendors: approve, pending, or ban.',
  $md$
## Path

**Directory → Vendors**.

## Steps

1. Search or filter the list.
2. Open a vendor for details.
3. Set approval to **approved**, **pending**, or **banned**.

## Effects

- **Approved**: can appear on Browse when their profile is ready
- **Pending**: not live for clients
- **Banned**: blocked from the marketplace as set

Changes are recorded in the Activity log.
$md$,
  'admin', 10, ARRAY['admin-suspend-clients','admin-dashboard-overview']
),
(
  'a1111111-1111-4111-8111-111111111102',
  'admin-suspend-clients',
  'Suspend or restore client accounts',
  'Directory Clients: suspend and unsuspend.',
  $md$
## Path

**Directory → Clients**.

## Steps

1. Search by email or filter suspended accounts.
2. Open the client.
3. **Suspend** or **unsuspend** with confirmation.

Use suspend for abuse or policy breaches. Prefer clear notes in related disputes when relevant.
$md$,
  'admin', 20, ARRAY['admin-approve-vendors','admin-activity-log']
),
(
  'a1111111-1111-4111-8111-111111111103',
  'admin-find-bookings',
  'Find and open bookings',
  'Commerce Bookings list and booking detail.',
  $md$
## Path

**Commerce → Bookings**.

## Filters

- Status
- Search
- Date range
- Rows that need attention

## Open a booking

Click a row for the detail page.

You will see parties, amounts, payment status, dates, and linked review or dispute when relevant.

Any admin can **view**. Money buttons are **super admin** only.
$md$,
  'admin', 10, ARRAY['admin-booking-support-actions','admin-support-hold']
),
(
  'a1111111-1111-4111-8111-111111111103',
  'admin-booking-support-actions',
  'Booking support actions (super admin)',
  'Check payment, pay vendor, complete, cancel, and related fixes.',
  $md$
## Who

**Super admin** only. Support admins can view and ask a super admin for help.

## Path

Open a booking → **Support actions**.

## Typical actions

- **Check payment**: refresh payment status
- **Unblock payment**: clear a stuck payment page
- **Pay vendor**: release or retry paying the vendor when appropriate
- **Finish cancellation**: complete a stuck cancel
- **Mark complete** for client and/or vendor when needed
- **Pause / resume payment** to the vendor
- **Re-run checks**
- **Cancel on behalf**: choose who and enter a reason (at least 3 characters)

Prefer the smallest fix first. Confirm payment state before moving money. Actions are recorded in the Activity log.
$md$,
  'admin', 20, ARRAY['admin-support-hold','admin-roles-explained','admin-find-bookings']
),
(
  'a1111111-1111-4111-8111-111111111103',
  'admin-support-hold',
  'Pause paying the vendor',
  'Hold automatic payment while you investigate.',
  $md$
## Who

**Super admin**.

## When

Use while looking into a dispute or incomplete event before money should move.

## Steps

1. Open the booking.
2. **Pause payment** to the vendor.
3. Investigate using Disputes, Messages, and booking chat.
4. **Resume** when it is safe for payment rules to continue.
$md$,
  'admin', 30, ARRAY['admin-booking-support-actions','admin-triage-disputes']
),
(
  'a1111111-1111-4111-8111-111111111104',
  'admin-read-financials',
  'Read platform financials',
  'Commerce Financials: spend, fees, and charts.',
  $md$
## Path

**Commerce → Financials**.

## Any admin can

- Pick a time period
- Read totals such as client spend, platform fee percentage, and paid booking count
- View charts for spend, fees, and volume

## Download spreadsheet

Downloading financials is **super admin** only when that control is available. Downloads are recorded in the Activity log.
$md$,
  'admin', 10, ARRAY['admin-marketplace-analytics','admin-roles-explained']
),
(
  'a1111111-1111-4111-8111-111111111104',
  'admin-marketplace-analytics',
  'Marketplace analytics',
  'From first request through finished bookings.',
  $md$
## Path

**Commerce → Marketplace**.

## What to look at

- Steps from request → accept → pay → complete, and conversion rates
- How fast vendors reply
- Ratings and profile views
- Why bookings fail when that is shown
- Breakdowns by category and place
- Top vendors when shown

Use this to spot slow replies and drop-offs after accept.
$md$,
  'admin', 20, ARRAY['admin-read-financials','admin-dashboard-overview']
),
(
  'a1111111-1111-4111-8111-111111111105',
  'admin-triage-disputes',
  'Triage disputes',
  'Assign, update status, and leave notes for each party.',
  $md$
## Path

**Trust & safety → Disputes**.

## Any admin can

1. Filter by status (open, under review, resolved, closed).
2. Open a dispute.
3. **Assign** (including to yourself).
4. Change status.
5. Write notes the client and/or vendor can see.
6. Open related booking chat when needed.

## Money outcomes

Paying the vendor or refunding is **super admin** only.
$md$,
  'admin', 10, ARRAY['admin-resolve-dispute-money','admin-support-hold']
),
(
  'a1111111-1111-4111-8111-111111111105',
  'admin-resolve-dispute-money',
  'Resolve disputes with money (super admin)',
  'Pay the vendor, full refund, or partial refund.',
  $md$
## Who

**Super admin** only.

## Steps

1. Finish review and notes.
2. Choose an outcome:
   - **Pay the vendor**
   - **Full refund to the client**
   - **Partial refund** (enter the amount in pounds)
3. Resolve so the dispute is marked resolved.

Support admins should assign a super admin and leave a clear recommendation in notes.
$md$,
  'admin', 20, ARRAY['admin-triage-disputes','admin-roles-explained']
),
(
  'a1111111-1111-4111-8111-111111111105',
  'admin-moderate-reviews',
  'Moderate reviews',
  'Hide or show public vendor reviews.',
  $md$
## Path

**Trust & safety → Reviews**, then open a review.

## Steps

1. Find the review.
2. Open the detail page.
3. **Hide** from the public profile or **show** again when appropriate.

Use hide for abuse or policy breaches. Actions are recorded in the Activity log.
$md$,
  'admin', 30, ARRAY['admin-triage-disputes','admin-activity-log']
),
(
  'a1111111-1111-4111-8111-111111111106',
  'admin-support-inbox',
  'Support inbox',
  'Read, reply, and mark conversations.',
  $md$
## Path

**Messages → Inbox**.

## Steps

1. Open unread conversations.
2. Read the thread.
3. **Reply** as Eventtz Support.
4. Mark read when done.

Prefer clear replies and include booking IDs when useful.
$md$,
  'admin', 10, ARRAY['admin-compose-broadcast','admin-find-bookings']
),
(
  'a1111111-1111-4111-8111-111111111106',
  'admin-compose-broadcast',
  'Compose and send messages',
  'Message selected people or all clients / vendors.',
  $md$
## Path

**Messages → Compose**.

## Options

- Selected users
- All clients
- All vendors
- All users (when offered)

## Steps

1. Choose who receives it.
2. Write the message.
3. Send.

Double-check the audience before sending widely. Sends are recorded in the Activity log.
$md$,
  'admin', 20, ARRAY['admin-support-inbox','admin-suspend-clients']
),
(
  'a1111111-1111-4111-8111-111111111107',
  'admin-blog-cms',
  'Manage blog posts',
  'Create, edit, publish, and remove posts.',
  $md$
## Paths

- List: **/admin/blog**
- Editor: open a post or create a new one

## Steps

1. Create or open a post.
2. Edit title, subtitle, web address slug, author name, cover image, and body.
3. **Save** as draft.
4. **Publish** when ready, or **unpublish**.
5. **Delete** only when you mean it.

Published posts appear on the public blog.
$md$,
  'admin', 10, ARRAY['admin-sign-in-console','admin-activity-log']
),
(
  'a1111111-1111-4111-8111-111111111108',
  'admin-team-manage',
  'Invite and manage the admin team',
  'Super admin: invite, change roles, suspend admins.',
  $md$
## Path

**/admin/team**.

## Any admin

Can view who is on the team and their role.

## Super admin only

- **Invite** a new admin
- Change role between support admin and super admin
- **Suspend** or reactivate (not yourself)

The system protects against removing the last super admin. Support admins should ask a super admin for team changes.
$md$,
  'admin', 10, ARRAY['admin-roles-explained','admin-activity-log']
),
(
  'a1111111-1111-4111-8111-111111111108',
  'admin-activity-log',
  'Use the activity log',
  'Filter and inspect recorded admin actions.',
  $md$
## Path

**/admin/audit** (Activity log).

## Filters

Bookings, clients, vendors, disputes, reviews, chat, financials, team, and more.

## How to use

1. Filter to the area you care about.
2. Open an entry for details and related IDs.
3. Follow links to bookings or disputes when shown.

Use the log after money moves, approvals, suspensions, and team changes.
$md$,
  'admin', 20, ARRAY['admin-team-manage','admin-booking-support-actions']
),
(
  'a1111111-1111-4111-8111-111111111109',
  'admin-email-testing',
  'Send test emails',
  'Super admin Email testing.',
  $md$
## Who

**Super admin** only.

## Path

**/admin/email**.

## Steps

1. Pick a category (Marketing, Account, Booking, Admin alerts).
2. Choose a template.
3. Enter a recipient.
4. Send a test.

Prefer your own inbox for checks. Do not spam real customers. Tests are recorded in the Activity log.
$md$,
  'admin', 10, ARRAY['admin-roles-explained','admin-activity-log']
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
