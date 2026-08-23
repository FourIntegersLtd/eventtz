-- Help Center: kinder, more polite tone for all articles and category descriptions.
-- Run after 081. UPDATE only. No deletes.
--
-- Voice: second person, plain English, polite (please, we're happy to help, don't worry).
-- Keeps ### N. Title steps, > [!NOTE]/[!WARNING]/[!IMPORTANT] callouts, bullets, and ## headings.
-- No em dashes. Terse commands softened (Open -> Please open / You can open; Do not -> Please don't).
--
-- Slugs covered (74): all client, vendor, and admin articles from 080/081.

-- ---------------------------------------------------------------------------
-- Category descriptions
-- ---------------------------------------------------------------------------
UPDATE public.help_categories
SET
  description = CASE slug
    WHEN 'admin-blog' THEN 'Create and publish blog posts.'
    WHEN 'admin-commerce-bookings' THEN 'Find bookings and help with payment actions when needed.'
    WHEN 'admin-commerce-insights' THEN 'Platform money summary and marketplace stats.'
    WHEN 'admin-directory' THEN 'Review vendors and clients in the directory.'
    WHEN 'admin-email' THEN 'Send test emails to check templates (super admin).'
    WHEN 'admin-getting-started' THEN 'Sign in and see what each admin role can do.'
    WHEN 'admin-messages' THEN 'Support inbox and broadcast messages.'
    WHEN 'admin-referrals' THEN 'Referral partners and vendor signup links.'
    WHEN 'admin-team-audit' THEN 'Your admin team and activity history.'
    WHEN 'admin-trust' THEN 'Help with disputes and reviews.'
    WHEN 'client-account' THEN 'Your password, settings, and closing your account if you need to.'
    WHEN 'client-booking' THEN 'Ask, agree on a price, pay when you''re happy, and confirm after your event.'
    WHEN 'client-chat' THEN 'Message vendors and share contact details after you pay.'
    WHEN 'client-getting-started' THEN 'Sign up, browse vendors, and we''ll help you find your way around.'
    WHEN 'client-payments' THEN 'When you pay, our small fee, and how we keep your money safe until your event.'
    WHEN 'client-planning' THEN 'Plan your celebration with helpful vendor ideas.'
    WHEN 'client-problems' THEN 'If something goes wrong, please tell us. We''re happy to help.'
    WHEN 'vendor-account' THEN 'Your settings, notifications, and account options.'
    WHEN 'vendor-bookings' THEN 'Accept requests, send quotes, and complete your events.'
    WHEN 'vendor-disputes' THEN 'If there''s a problem, please tell us. We''re here to help.'
    WHEN 'vendor-earnings' THEN 'Your fees, payouts, and payment documents.'
    WHEN 'vendor-go-live' THEN 'Get approved and set up how you''d like to get paid.'
    WHEN 'vendor-join' THEN 'Create your profile and submit it for our team to review.'
    WHEN 'vendor-profile' THEN 'Edit your listing and see how it''s doing.'
    ELSE description
  END,
  updated_at = now()
WHERE slug IN (
  'admin-blog', 'admin-commerce-bookings', 'admin-commerce-insights', 'admin-directory', 'admin-email', 'admin-getting-started', 'admin-messages', 'admin-referrals', 'admin-team-audit', 'admin-trust', 'client-account', 'client-booking', 'client-chat', 'client-getting-started', 'client-payments', 'client-planning', 'client-problems', 'vendor-account', 'vendor-bookings', 'vendor-disputes', 'vendor-earnings', 'vendor-go-live', 'vendor-join', 'vendor-profile'
);

-- ---------------------------------------------------------------------------
-- Client
-- ---------------------------------------------------------------------------
UPDATE public.help_articles
SET
  title = 'Create a client account',
  summary = 'Sign up and we''ll help you open your portal.',
  body_md = $md$
Create a client account to browse vendors, send requests, and pay through Eventtz. We're happy to help you get started.

### 1. Create your account
Please tap **Client register** on Eventtz. Enter your email and choose a password.

### 2. Confirm your email
If we ask you to confirm your email, follow the link we send, then sign in. You will see your **Dashboard**.

We may ask for a **preferred name**. Vendors see this name on your bookings instead of your email. You can change it later in **Settings**.

## What to do next

- You can open **Browse** to find vendors.
- Save people you like with the heart (**Favourites**).
- Please send a request when you are ready to book.
$md$,
  updated_at = now()
WHERE slug = 'client-create-account';

UPDATE public.help_articles
SET
  title = 'How to browse and find vendors',
  summary = 'Search by what you need, where, and when. We''re here to help you find the right fit.',
  body_md = $md$
You can open **Browse** in your client area. This is where approved vendors are listed.

You can type what you need in plain words (for example "catering in Manchester for 80 guests"), filter by type, and set place, dates, and budget when those options are shown.

## Before you send a request

Please open a vendor to check packages and prices, photos and past work, reviews from other clients, and how quickly they usually reply.

- Please tap the heart to save vendors you like.
- If dates look busy, still ask. The vendor can confirm in chat.
- Please compare a few people before you pay anyone.

You can also use **Plan my event** for AI ideas, then jump into Browse with useful filters already set.
$md$,
  updated_at = now()
WHERE slug = 'client-browse-vendors';

UPDATE public.help_articles
SET
  title = 'Saving vendors to Favourites',
  summary = 'Keep a shortlist while you compare. No rush.',
  body_md = $md$
Please tap the **heart** on a vendor to save them. Open **Favourites** anytime to see your list.

- Compare people without losing them in search.
- Ask several saved vendors the same question at once.
- Come back later if you are still deciding.

Favourites stay with your signed-in account. Removing a favourite doesn't cancel a booking you already started.
$md$,
  updated_at = now()
WHERE slug = 'client-favourites';

UPDATE public.help_articles
SET
  title = 'How does booking work?',
  summary = 'Ask, agree on a price, pay when they say yes, then confirm after your event.',
  body_md = $md$
Everything stays in one place from first browse to payment. You don't pay until the vendor accepts, and the date isn't held until you pay.

> [!NOTE]
> You can message several vendors at once, but only **pay** the booking you want to keep.

### 1. Browse and choose
You can open **Browse** (or **Plan my event** for AI ideas). Check packages, reviews, and prices. Save favourites with the heart icon. Several vendors for the same celebration can sit together on **Bookings** and **Dashboard**.

### 2. Send a request
Please pick a package or service, add your date and venue if you have them, and send a booking request. Track it under **Bookings**. You can enquire with more than one vendor until you pay.

### 3. Agree the details
Please use **Messages** to agree scope and price. The vendor may send an updated price. Accept or decline from the booking page.

### 4. Pay after they accept
When the vendor accepts, pay from the booking page. You see the full total, including the Eventtz fee, before you confirm.

### 5. After the event
Please confirm completion if it went well so the vendor can be paid. If something went wrong, open **Disputes** instead.
$md$,
  updated_at = now()
WHERE slug = 'client-how-booking-works';

UPDATE public.help_articles
SET
  title = 'Asking several vendors at once',
  summary = 'Send the same brief to more than one vendor. It''s free to ask.',
  body_md = $md$
You can use this when you want options before you choose. You are not charged to ask. You only pay after a vendor accepts and you complete payment on that booking.

> [!NOTE]
> Each vendor gets a separate request. Please cancel the ones you no longer need so everyone knows where they stand.

### 1. Select vendors
On **Browse** or **Favourites**, select more than one vendor.

### 2. Send one shared brief
Please open the multi-ask flow and fill one shared brief (date, place, notes). Send. Each vendor gets their own request with that brief.

## What happens next

- Please chat with each vendor separately.
- Compare replies and prices.
- Pay only the one you choose after they accept.
- Please cancel or leave the others when you no longer need them.
$md$,
  updated_at = now()
WHERE slug = 'client-multi-enquire';

UPDATE public.help_articles
SET
  title = 'Accepting or declining a price',
  summary = 'Please respond when a vendor sends a new quote or price change.',
  body_md = $md$
While you are still deciding, a vendor may send a custom quote from chat, or a price update for extras or a discount.

> [!NOTE]
> Please read the new total carefully. You only pay after you **accept** the price and the vendor has accepted the booking.

### 1. Open the booking
Please open the booking under **Bookings** and read the new total carefully.

### 2. Accept or decline
**Accept** if you agree, or **Decline** if you do not.

You only pay after you and the vendor agree the price, and they have accepted the booking. If you decline, keep chatting or cancel that request if you are done with that vendor.
$md$,
  updated_at = now()
WHERE slug = 'client-accept-quote';

UPDATE public.help_articles
SET
  title = 'Cancelling and refunds',
  summary = 'Cancel before the vendor is paid and you''ll get a full refund.',
  body_md = $md$
Please open the booking and use **Cancel** when it is allowed.

Common cases:

- You asked but the vendor has not accepted yet.
- They accepted but you have not paid yet.
- You paid, but money has not been released to the vendor yet.

## If you already paid

If you cancel before the vendor is paid, you'll get a **full refund** to your card. Banks often take **5 to 10 working days** to show it. If the vendor cancels after you paid, we refund you.

> [!NOTE]
> Please don't use cancel for a problem after the day. Open a **dispute** from the booking so we can pause paying the vendor and help.

Please use **Contact** if something looks wrong.
$md$,
  updated_at = now()
WHERE slug = 'client-cancel-refund';

UPDATE public.help_articles
SET
  title = 'Confirming the event went well',
  summary = 'Confirm after your event so the vendor can be paid. We''ll remind you the day before too.',
  body_md = $md$
For a paid booking, we send an **event tomorrow** reminder the day before so you have time, venue, and messages in one place.

### 1. Open the booking
After the event, please open the booking under **Bookings**.

### 2. Confirm it went well
Please confirm it is complete when asked. The vendor should confirm on their side too. When **both** of you confirm, the vendor can be paid sooner.

If nobody reports a problem, money can go to the vendor about **48 hours** after the event.

> [!WARNING]
> If something went wrong, please don't confirm. Please open a **dispute** from the booking so we can hold the money and review.

After a successful booking you may be asked to leave a review.
$md$,
  updated_at = now()
WHERE slug = 'client-complete-booking';

UPDATE public.help_articles
SET
  title = 'Leaving a review',
  summary = 'Share a kind, honest review after your booking. You can add up to five photos.',
  body_md = $md$
After a completed booking, we may ask you to leave a review. Honest reviews help other clients and good vendors.

> [!NOTE]
> If you have an open **dispute**, please wait until it is resolved before leaving a review.

- Please be fair and specific (timing, quality, communication).
- You can attach up to **five photos** of the event.
- If you have an open dispute, sort that first.

You may find past reviews under **Settings** when that section is shown.
$md$,
  updated_at = now()
WHERE slug = 'client-leave-review';

UPDATE public.help_articles
SET
  title = 'When do I pay?',
  summary = 'Pay after the vendor accepts. Your date isn''t held until payment goes through.',
  body_md = $md$
You pay **after the vendor accepts**. Asking does not cost anything. The date is **not held** until payment goes through.

> [!NOTE]
> The full total, including the **5% Eventtz fee**, is shown on the payment page before you confirm.

### 1. Open the accepted booking
Please open it under **Bookings** and tap **Pay**.

### 2. Check the total and pay
Please check the full total (packages, agreed changes, and the Eventtz fee), then pay securely on the payment page.

If you have not paid about **24 hours** after they accept, we remind you to pay to confirm the date.

> [!WARNING]
> If you wait too long, another client could book the same date with that vendor.

After you pay, we hold the money until the event is done. You can open a **Payment receipt** from the booking or **Payment history**.

If payment fails, try again from the same booking or use **Contact** and include the booking ID.
$md$,
  updated_at = now()
WHERE slug = 'client-when-do-i-pay';

UPDATE public.help_articles
SET
  title = 'Is there a service fee?',
  summary = 'Yes, 5%. We always show it clearly before you pay.',
  body_md = $md$
Eventtz adds a **5% fee** on top of the vendor's agreed price. There are no surprise extras beyond what the booking already shows.

> [!NOTE]
> The fee is always shown on the payment page before you pay. Vendors keep the price you agreed.

Before you pay you always see:

- **Vendor amount.** What you agreed with the vendor.
- **Service fee.** 5% on top.
- **Total.** What you pay.

Vendors keep the price you agreed. The fee is paid by you on top. We do not take a cut out of the vendor's quote.
$md$,
  updated_at = now()
WHERE slug = 'client-service-fee';

UPDATE public.help_articles
SET
  title = 'Is my payment safe?',
  summary = 'We hold your money safely until your event is done.',
  body_md = $md$
When you pay, Eventtz holds the money safely for you. The vendor is not paid the moment you pay. You pay on a secure payment page. Eventtz doesn't keep your full card number.

> [!NOTE]
> Your money stays protected until the event is done and any problems are resolved.

Money can be released when you and the vendor both say the event went well, or about **48 hours** after the event if nobody reports a problem.

If there is a problem, report it from the booking (**Disputes**). We can pause paying the vendor while we look into it.
$md$,
  updated_at = now()
WHERE slug = 'client-payment-safe';

UPDATE public.help_articles
SET
  title = 'Messaging vendors',
  summary = 'Chat from a vendor profile or from your booking.',
  body_md = $md$
You can open **Messages** for all chats, start chat from a vendor profile, or open chat from a booking so it stays linked to that event.

Please talk about dates, guest numbers, venue, packages, extras, and price changes. Confirm money changes on the booking when asked.

Please keep important agreements in Eventtz chat or on the booking so both sides have a record.
$md$,
  updated_at = now()
WHERE slug = 'client-messaging-vendors';

UPDATE public.help_articles
SET
  title = 'Sharing phone and email',
  summary = 'When contact details can be shared after you pay.',
  body_md = $md$
Until you pay, phone and email are often hidden so you chat inside Eventtz.

> [!NOTE]
> After you pay, contact details may appear so you can coordinate by phone or email for the event.

Once you have paid, contact details may become visible so you can coordinate by phone or email. Venue details you added on the booking are for the vendor when you provided them.

Under **Settings**, please check sharing preferences. Change them if you want stricter sharing.
$md$,
  updated_at = now()
WHERE slug = 'client-contact-sharing';

UPDATE public.help_articles
SET
  title = 'What if something goes wrong?',
  summary = 'If something went wrong, please report it from your booking. We may pause paying the vendor while we help.',
  body_md = $md$
If something serious went wrong (no-show, major quality issue, safety concern), don't worry. Please report it from the booking so we can pause paying the vendor and review.

> [!IMPORTANT]
> Please open a **dispute** instead of confirming the event went well. Confirming tells us the booking finished successfully.

### 1. Open the booking
Please open it under **Bookings**, or go to **Disputes** in the menu.

### 2. Report the problem
Please choose to report a problem / open a dispute. Explain what happened and add photos if you can.

We review the case and may **pause paying the vendor** until it is sorted. Check the dispute for updates.

Disputes aren't for simple how-to questions (use Help or **Contact**) or changing your mind before the event when cancel still works.
$md$,
  updated_at = now()
WHERE slug = 'client-report-problem';

UPDATE public.help_articles
SET
  title = 'Contact Eventtz support',
  summary = 'Send us a message for account and money questions. We''re happy to help.',
  body_md = $md$
Please use **Contact** in your portal to message Eventtz. We aim to reply by email within about **two working days**.

Please include your account email, the booking ID for booking or payment issues, and a clear description (screenshots if useful).

- **Help** and **Ask:** how-to questions ("How do I pay?", "How do bookings work?").
- **Contact:** account problems or payment failures we need to investigate.
- **Disputes:** something went wrong with a paid or finished booking.

If Ask cannot answer safely (for example about refunds or bans), it will tell you to use **Contact** or **Disputes**.
$md$,
  updated_at = now()
WHERE slug = 'client-contact-support';

UPDATE public.help_articles
SET
  title = 'Are vendors checked?',
  summary = 'Every vendor finishes setup and we review them before they go live.',
  body_md = $md$
Every vendor completes a profile. Our team reviews each listing before it appears on Browse.

> [!NOTE]
> Reviews and ratings on a profile are from real clients. Read them alongside the vendor's packages and photos.

You can also check ratings and written reviews, signs of completed bookings on the profile, and photos and credentials the vendor added.

Checks reduce risk. You should still read the profile and agree details in chat before you pay.
$md$,
  updated_at = now()
WHERE slug = 'client-are-vendors-vetted';

UPDATE public.help_articles
SET
  title = 'Resetting your password',
  summary = 'Please use Forgot password on the sign-in page.',
  body_md = $md$
If you are signed in, please open **Settings** and change your password there.

### 1. Open Client login
If you are signed out, please open **Client login** and choose **Forgot password**.

### 2. Use the email link
Please enter your email, then open the link we send (usually valid for about **one hour**). Choose a new password and sign in.

Please check spam if the email is slow. Request a new link if the old one expired. Use **Contact** if you can't access that email inbox.
$md$,
  updated_at = now()
WHERE slug = 'client-password-reset';

UPDATE public.help_articles
SET
  title = 'Account settings',
  summary = 'Your name, password, sharing, notifications, and account options.',
  body_md = $md$
Please open **Settings** in the client area. There are three tabs: **Account**, **Privacy**, and **More**.

- **Preferred name.** Shown to vendors on bookings.
- **Password.** Change while signed in.
- **Delete account.** Permanently close the account. See **Delete your account**.
- **Contact sharing.** Control email and phone sharing.
- **Notifications.** Booking updates and messages.

Please keep your email up to date so you don't miss pay prompts or the day-before event reminder. Keyboard shortcuts and legal links are under **More**.
$md$,
  updated_at = now()
WHERE slug = 'client-account-settings';

UPDATE public.help_articles
SET
  title = 'Plan my event with AI',
  summary = 'Describe your celebration and get a helpful budget, checklist, and vendor ideas.',
  body_md = $md$
From your portal, go to **Plan my event**. Describe your celebration and Eventtz builds a plan you can save and come back to.

### 1. Describe your event
Please write in plain English (for example: "Birthday party for 80 people in London in June, need catering and a DJ").

### 2. Review the plan
Please check the budget breakdown, checklist, and vendor suggestions.

### 3. Book from a suggestion
Please tap **Book now** on a suggestion to open **Browse** with useful filters already set.

You can still browse and book without the planner. When you are ready, send booking requests from **Browse** or **Favourites** as usual.
$md$,
  updated_at = now()
WHERE slug = 'client-event-planner';

UPDATE public.help_articles
SET
  title = 'Your dashboard',
  summary = 'See what needs your attention: quotes, payments, completion, and reviews.',
  body_md = $md$
You can open **Dashboard** when you sign in. The top cards show bookings that need action. Tap any card to open the booking.

- A new price to accept or decline.
- Payment ready after the vendor accepted (the date isn't held until you pay).
- Please confirm the event went well after the date.
- Please leave a review when invited.

Paid bookings for the same celebration can appear together. Upcoming bookings appear on the calendar. We also remind you the day before a paid event.

You can use **Browse** or **Plan my event** when you are still planning.
$md$,
  updated_at = now()
WHERE slug = 'client-dashboard';

UPDATE public.help_articles
SET
  title = 'Using Help and Ask',
  summary = 'Browse articles or ask our Help assistant in the portal.',
  body_md = $md$
Please tap the **?** button at the bottom of your screen to open Help. Pick a category, then open an article, or use **Ask** to type a question in your own words. The assistant answers from Eventtz help articles.

- **Help** and **Ask:** how-to questions.
- **Contact:** account problems or payment failures.
- **Disputes:** something went wrong with a paid or finished booking.

If Ask cannot answer safely (for example about refunds or bans), it will tell you to use **Contact** or **Disputes**.
$md$,
  updated_at = now()
WHERE slug = 'client-help-assistant';

UPDATE public.help_articles
SET
  title = 'Delete your account',
  summary = 'You can permanently close your Eventtz account from Settings.',
  body_md = $md$
You can close your Eventtz account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details.

> [!IMPORTANT]
> Deleting your account is permanent. Please finish or cancel open bookings before you continue.

> [!WARNING]
> This can't be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. The other person on a booking still sees the date, venue, and amounts.

## Before you start

You will need your current password.

You'll need to wait before deleting if:

- **Payment in progress.** Finish payout or wait for a refund.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

## Delete your account

### 1. Open Settings
From the client area, select **Settings**, then **Account**.

### 2. Confirm and delete
Please tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account. The other person still has the booking contract, and your name shows as a deleted user.
$md$,
  updated_at = now()
WHERE slug = 'client-delete-account';

UPDATE public.help_articles
SET
  title = 'Payment history and receipts',
  summary = 'See your past payments and open a payment receipt.',
  body_md = $md$
You can download a receipt for a paid booking, or browse everything you have paid, refunded, or paid out.

> [!NOTE]
> Receipts appear only after payment succeeds. Use the booking ID in **Contact** if a paid receipt is missing.

You can open **Payment history** from your portal, or from a paid booking. On a paid booking, open **Payment receipt**. You can view it on screen and download or print the page. The receipt shows the event, amounts (including the Eventtz fee), and payment status.

Receipts appear after payment succeeds. If you paid and still cannot see one, use **Contact** and include the booking ID.
$md$,
  updated_at = now()
WHERE slug = 'client-payment-receipts';

-- CLIENT_END

-- ---------------------------------------------------------------------------
-- Vendor
-- ---------------------------------------------------------------------------
UPDATE public.help_articles
SET
  title = 'How do I join Eventtz?',
  summary = 'Create your profile and submit for review. Bank setup can wait until you''re ready.',
  body_md = $md$
Join as a vendor, finish your profile, and submit for review. You don't need to set up payments to submit or to appear on Browse after approval.

> [!NOTE]
> Please finish **Payments** before you **accept** your first paid booking. You can submit your profile without it.

### 1. Create your account
Please open **Vendor register** and create your account.

### 2. Complete Profile
Please sign in and open **Profile**. Complete each step (business basics, services, place, prices, photos, policies, review).

### 3. Submit for review
Please tap **Submit for review**. Our team reviews your listing. When you are approved, clients can find you on Browse.

Set up how you get paid when you are ready to **accept** your first booking, or anytime under **Payments**.
$md$,
  updated_at = now()
WHERE slug = 'vendor-how-to-join';

UPDATE public.help_articles
SET
  title = 'Vendor profile steps',
  summary = 'Eight friendly steps from Account through Review, then submit.',
  body_md = $md$
Please open **Profile** and work through each step. Progress saves as you go.

> [!NOTE]
> Packages need clear **What's included** text. Clients book from packages, not vague chat promises.

1. **Account.** Contact details and profile photo.
2. **Business.** Business name, services, and bio basics.
3. **Location.** Where you work and travel rules.
4. **Pricing.** Packages with clear **What's included** text. See **Pricing, packages, and AI help**.
5. **Availability.** When you can take bookings.
6. **Portfolio.** Photos (and video if you offer it).
7. **Additional info.** Optional certificates or disclosures.
8. **Review.** Check everything, then **Submit for review**.

Some fields may stay read-only until we finish review. If we need changes, we return your profile to draft and email you.

After approval, edit your live listing from **Profile**. Keep packages, photos, and availability up to date.
$md$,
  updated_at = now()
WHERE slug = 'vendor-onboarding-steps';

UPDATE public.help_articles
SET
  title = 'When will my profile go live?',
  summary = 'Approval, Browse visibility, and payout setup are separate steps. Don''t worry, we''ll guide you.',
  body_md = $md$
Going live is three separate things. Don't worry, we'll walk you through each one.

> [!NOTE]
> Approval and **Browse** visibility don't mean payout setup is done. Finish **Payments** before you accept a paid booking.

### 1. Submit and get approved
Please finish **Profile** and **Submit for review**. Our team approves when the listing meets our standards.

### 2. Browse visibility
After approval, clients can usually find you on **Browse** when automatic listing rules pass. Admins can also hide or force-publish a listing.

### 3. Payout setup before accepting bookings
Setting up how you get paid is **not** required to be approved. You **do** need it finished before you can **accept** a booking that will be paid through Eventtz.

**Profile**, **Dashboard**, and **Payments** show approval status, listing reminders, and payout setup.
$md$,
  updated_at = now()
WHERE slug = 'vendor-when-live';

UPDATE public.help_articles
SET
  title = 'Set up how you get paid',
  summary = 'Please finish how you get paid before you accept. We''ll nudge you if setup is still open.',
  body_md = $md$
You'll need to finish payout setup before you can accept a client booking. That way money can move safely after the event. That way money can move safely after the event.

> [!WARNING]
> If payout setup isn't finished when a booking is ready to pay out, we **hold** the money until you complete it.

Please open **Payments**, or follow the prompt when you try to **accept** a booking.

### 1. Start payout setup
Please start from **Payout account**.

### 2. Complete identity and bank details
Please finish the steps with our payments partner, then return to Eventtz and wait until setup shows as ready.

If payout setup is still open about **24 hours** after we approve you, we email a reminder to finish it.

When everyone confirms (or about **48 hours** after the event with no problem), money goes to your bank on the payments partner's schedule. If both sides confirmed but payout setup isn't ready, we **hold** the payout until you finish it.
$md$,
  updated_at = now()
WHERE slug = 'vendor-stripe-payouts';

UPDATE public.help_articles
SET
  title = 'Accepting or declining requests',
  summary = 'Please respond from Bookings once getting paid is set up. We''ll remind you if a request is waiting.',
  body_md = $md$
Please respond from **Bookings**. Faster replies win more bookings. We remind you if a request is still waiting, usually after about **1 hour**, **6 hours**, and **24 hours**.

> [!NOTE]
> The date isn't confirmed for the client until they pay. Accept quickly, then watch for their payment.

### 1. Open the request
Please open **Bookings**, then the pending request. Read the date, place, packages, and notes. Chat if you need clarity.

### 2. Accept or decline
**Accept** or **Decline**. If how you get paid isn't ready, Eventtz will ask you to finish bank setup first. After you return from the payments partner, open the booking again to accept.

After you accept, the client can pay. The date isn't confirmed for them until they pay. Watch **Messages** and **Notifications**.
$md$,
  updated_at = now()
WHERE slug = 'vendor-accept-booking';

UPDATE public.help_articles
SET
  title = 'Updating the price',
  summary = 'Send extras or discounts while the booking is still pending.',
  body_md = $md$
On a pending booking you can send a new price (extras or discounts).

> [!NOTE]
> The client must **accept** the new total before they pay. Explain changes in chat so they are not surprised.

### 1. Create the update
Please open the booking and create the update with clear line items.

### 2. Send it
Please send it to the client and wait for them to **accept** or **decline**.

The client pays only after the agreed total is accepted and you have accepted the booking (when those steps apply). Explain price changes in chat so the client is not surprised.
$md$,
  updated_at = now()
WHERE slug = 'vendor-price-update';

UPDATE public.help_articles
SET
  title = 'Sending a custom quote from Messages',
  summary = 'Create a booking quote for a client from chat.',
  body_md = $md$
From a message thread you can send a **custom quote** with event details and a price. It creates a booking the client can review, accept, and pay.

> [!NOTE]
> Please put the agreed total on the booking, not only in chat. The client pays from the booking page.

You can use it when a client messaged you without a full request form, you agreed a bespoke package in chat, or you want a clear total on a booking, not only chat text.
$md$,
  updated_at = now()
WHERE slug = 'vendor-custom-quote';

UPDATE public.help_articles
SET
  title = 'Completing or cancelling a booking',
  summary = 'Confirm after paid events. Payout may wait if payout setup isn''t finished yet.',
  body_md = $md$
### 1. Confirm after a paid event
Please open the booking and confirm **completion** when the work is done. The client should confirm too when asked.

When both of you confirm, payout can start sooner. If nobody reports a problem, money can be released about **48 hours** after the event.

If payout setup isn't finished, we hold the payout until you complete it in **Payments**.

## Cancelling

> [!WARNING]
> Cancelling a **paid** booking may trigger a refund to the client. Check the buttons on that booking before you confirm.

Please use cancel on the booking when it is allowed. Rules differ for unpaid requests vs paid bookings. Check the buttons on that booking.

If the client had already paid and a refund is due, Eventtz handles the refund for that booking state. Use **Contact** if something looks stuck.
$md$,
  updated_at = now()
WHERE slug = 'vendor-complete-cancel';

UPDATE public.help_articles
SET
  title = 'Messaging clients',
  summary = 'Please use Messages and booking chat to agree details.',
  body_md = $md$
You can open **Messages** for chats with clients. Booking chat keeps the conversation next to that request.

- Please answer requests quickly.
- Please confirm date, venue, and package in writing.
- Please send price updates on the booking when money changes.
- After payment, use shared contact details only when Eventtz shows them.

Unread counts appear in the menu so you don't miss replies.
$md$,
  updated_at = now()
WHERE slug = 'vendor-messages-clients';

UPDATE public.help_articles
SET
  title = 'Does Eventtz take a cut from my earnings?',
  summary = 'No. Clients pay the fee on top of your quote, not from yours.',
  body_md = $md$
Eventtz does **not** take a cut from your agreed quote. Clients pay a **5% fee** on top of what you agreed. You keep the vendor amount shown on the booking.

If your quote is £400, the client pays £400 plus the 5% fee. Your earnings for that booking are the £400 (unless a dispute changes the outcome).
$md$,
  updated_at = now()
WHERE slug = 'vendor-no-cut';

UPDATE public.help_articles
SET
  title = 'When do I get paid?',
  summary = 'After both sides confirm, or about 48 hours later. Held if payout setup isn''t finished yet.',
  body_md = $md$
The client pays after you accept. Eventtz holds the money. After the event, you and/or the client confirm it went well. If there is no problem, money can also release about **48 hours** after the event. Then money goes to your bank on the payments partner's schedule.

> [!NOTE]
> If both of you confirmed but **Payments** isn't ready, we hold the payout until you finish setup.

When **both** of you confirm, payout can start sooner. We also send an **event tomorrow** reminder the day before a paid booking.

## If payout is held

If you and the client both confirmed but how you get paid isn't ready, we hold the payout and notify you. Open **Payments** and finish payout setup so we can send the funds.

Other delays include an open dispute, paused payment, or bank checks still in progress. Check **Payments** and the booking. Use **Contact** with the booking ID if money is late after it should have been released.
$md$,
  updated_at = now()
WHERE slug = 'vendor-when-get-paid';

UPDATE public.help_articles
SET
  title = 'What happens if there is a dispute?',
  summary = 'Either side can report a problem. Payment may be held while we help.',
  body_md = $md$
You or the client can report a problem from the booking. Eventtz reviews it and may **hold payment** until it is sorted.

> [!IMPORTANT]
> Please reply quickly with facts and photos. Payment may stay on hold until the dispute is resolved.

### 1. Open the dispute
Please open **Disputes** or the booking dispute section.

### 2. Reply with facts
Please reply quickly with facts and evidence. Stay professional in the thread.

Our team may leave things as they are, issue a partial refund, or take other actions depending on the case. You will see notes on the dispute when available. Keep serious money issues in Eventtz so there is a clear record.
$md$,
  updated_at = now()
WHERE slug = 'vendor-dispute';

UPDATE public.help_articles
SET
  title = 'Contact Eventtz support',
  summary = 'Please use Contact for account and payment questions. We''re happy to help.',
  body_md = $md$
Please use **Contact** in the vendor area. We aim to reply by email within about **two working days**.

Please include your account email, the booking ID for payment or dispute questions, and screenshots for payment setup errors.

- **Help** and **Ask:** how-to questions first.
- **Contact:** account or payout setup problems.
- **Disputes:** active booking problems.
$md$,
  updated_at = now()
WHERE slug = 'vendor-contact-support';

UPDATE public.help_articles
SET
  title = 'Editing your live profile',
  summary = 'Update your services, photos, and availability after approval.',
  body_md = $md$
Once approved, open **Profile** to update your listing. Save as you go.

Please keep packages and prices, photos, service area and travel, and policies and availability notes current. Big changes may still be reviewed if our team needs to check them.
$md$,
  updated_at = now()
WHERE slug = 'vendor-edit-profile';

UPDATE public.help_articles
SET
  title = 'Vendor analytics',
  summary = 'See how your requests turn into bookings.',
  body_md = $md$
You can open **Analytics** to see how your profile is doing over a period: profile views, requests, accepts and outcomes, and reply-time style metrics when shown.

Please reply faster, keep packages clear and fairly priced, refresh photos, and finish how you get paid so you never block an accept. Use Dashboard reminders together with Analytics to catch unpaid accepts and payout setup.
$md$,
  updated_at = now()
WHERE slug = 'vendor-analytics';

UPDATE public.help_articles
SET
  title = 'Pricing, packages, and AI help',
  summary = 'Build clear packages and use AI tools on Pricing and Review.',
  body_md = $md$
Each **package** is one bookable service with a name, price, and **What's included** text. Clients need enough detail to know what they are booking.

A good package has a clear name (for example "Full day wedding photography"), a price, **What's included** with real detail (hours, deliverables, travel rules), and a profile photo on your account before you submit. Some categories (such as catering or baking) need at least one complete package before you can submit.

On **Pricing**, open **Help me improve my packages**. Eventtz reviews your packages and can suggest clearer names and descriptions. Review the changes, then save.

> [!NOTE]
> AI can make mistakes. Please always check prices and details before you submit.

On **Review**, you can **Generate bio with AI** or write your own. Keep it honest and under the word limit shown on screen. If we return your profile for edits, fix the items in the email and Eventtz Support message, then submit again from **Profile**.
$md$,
  updated_at = now()
WHERE slug = 'vendor-package-quality';

UPDATE public.help_articles
SET
  title = 'If we ask you to update your profile',
  summary = 'Your profile may go back to draft with a friendly message explaining what to fix.',
  body_md = $md$
Our team reviewed your submission and needs a few updates before we can approve you. Don't worry, this is normal. We return your profile to **draft** so you can edit it again.

You receive an **email** with the list of what to fix and a link to **Profile**, and the same message in **Eventtz Support** (open **Messages** and look for Eventtz Support).

### 1. Open Profile
Please sign in and open **Profile**.

### 2. Fix the items and submit
Update the items we listed (photos, packages, bio, and so on), then submit again when you are ready.

We review resubmissions in the same queue as new applications.
$md$,
  updated_at = now()
WHERE slug = 'vendor-profile-returned';

UPDATE public.help_articles
SET
  title = 'What you can do while waiting for approval',
  summary = 'You can edit Profile, read Messages, and Contact us while pending. Bookings unlock after approval.',
  body_md = $md$
While your profile is pending you can usually open **Profile** and finish or fix your application, open **Messages** to read **Eventtz Support**, use **Contact** to reach Eventtz, and read **Help**.

These areas stay unavailable until we approve you:

- **Bookings** (accepting client requests)
- **Analytics**
- **Payments** setup for live bookings
- Most other vendor tools that assume you are live

Once approved, you can open **Bookings**, **Payments**, and **Analytics**. You still need payout setup finished before you can **accept** a paid booking.
$md$,
  updated_at = now()
WHERE slug = 'vendor-pending-access';

UPDATE public.help_articles
SET
  title = 'Joining through a referral link',
  summary = 'Register with a partner link so Eventtz knows who referred you.',
  body_md = $md$
Some partners share a special **vendor register** link. If you open that link, Eventtz records the referral when you create your account.

Please open the link your partner sent, complete **vendor register** as usual, then finish **Profile** and submit when ready.

The referral doesn't change how approval or payouts work. It only helps Eventtz and the partner track signups.
$md$,
  updated_at = now()
WHERE slug = 'vendor-referral-signup';

UPDATE public.help_articles
SET
  title = 'Your Growth Co-pilot',
  summary = 'Daily tips, Growth Score, and AI help to win more bookings.',
  body_md = $md$
The **Growth Co-pilot** is your personal helper inside the vendor portal. It reads your real numbers (profile views, enquiries, response time) and suggests what to do next.

You can open it from the **sparkle button** on any vendor page, or read **Today's focus** on your dashboard.

Your **Growth Score** (0 to 100) tracks listing quality, response speed, booking conversion, client reviews, and availability. Improve the areas marked **needs work** first.

> [!NOTE]
> The co-pilot never changes your profile automatically. You always review and save.

On **Profile > Pricing**, tap **Help me improve my packages** for clearer package names and descriptions. On a pending booking, use **Draft accept message** to get a starting reply. Edit it before you send.

For refunds, disputes, payout problems, or account suspension, use **Contact**. The co-pilot will point you there for money questions.
$md$,
  updated_at = now()
WHERE slug = 'vendor-growth-copilot';

UPDATE public.help_articles
SET
  title = 'Understanding your Growth Score',
  summary = 'What each part means and how to improve it.',
  body_md = $md$
Your Growth Score is made of five areas.

- **Listing quality.** Clients need a clear photo, bio, bookable packages, and portfolio photos. Complete at least one package with name, price, and what's included.
- **Response speed.** Reply to new enquiries within **2 hours** when you can. Slow replies lower your score and clients may book someone else.
- **Booking conversion.** This measures enquiries that become completed bookings. Accept suitable jobs promptly and keep packages accurate.
- **Reviews.** After a great event, happy clients can leave a review. Strong reviews help you stand out on Browse.
- **Availability.** Set which weekdays you take bookings and your daily limit. Block dates when you are fully booked.
$md$,
  updated_at = now()
WHERE slug = 'vendor-growth-score-explained';

UPDATE public.help_articles
SET
  title = 'Account settings',
  summary = 'Password, sharing, notifications, and more under Settings.',
  body_md = $md$
Your **Settings** control login, privacy, notifications, and account deletion. These are separate from your public **Profile**.

> [!NOTE]
> Please use **Profile** to edit your public listing. Use **Settings** for login, privacy, and closing the account.

From the vendor area, select **Settings**.

- **Account.** Email, password, and **Delete account**.
- **Privacy.** Contact sharing and notification preferences.
- **More.** Keyboard shortcuts and legal links.

Please keep notification email on so you don't miss new requests, event reminders, or payout messages.
$md$,
  updated_at = now()
WHERE slug = 'vendor-account-settings';

UPDATE public.help_articles
SET
  title = 'Delete your account',
  summary = 'You can permanently close your vendor account from Settings.',
  body_md = $md$
You can close your vendor account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details, and your listing leaves Browse.

> [!IMPORTANT]
> Deleting your account is permanent. Finish open bookings and payouts before you continue.

> [!WARNING]
> This can't be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. Clients still see the date, venue, and amounts.

## Before you start

You will need your current password.

You'll need to wait before deleting if:

- **Payment or payout in progress.** Finish it first.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

Closing the account also closes payout setup with our payments partner. A new registration starts payout setup again.

### 1. Open Settings
From the vendor area, select **Settings**, then **Account**.

### 2. Confirm and delete
Please tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account.
$md$,
  updated_at = now()
WHERE slug = 'vendor-delete-account';

UPDATE public.help_articles
SET
  title = 'Payment record and payout statement',
  summary = 'View what the client paid and your payout document after release.',
  body_md = $md$
Please open **Payments** to set up how you get paid, then view documents for each booking after money has moved.

- **Payout account.** Set up or check how you get paid.
- **Payout history.** Bookings where money has moved.

After the client pays, you can open a **Payment record** (what they paid, including the Eventtz fee on their side). After your payout is released, you can open a **Payout statement** for that booking. View on screen, then download or print if you need a copy.

The payment record appears after the client pays. The payout statement appears after payout is released. If something looks stuck, finish payout setup or use **Contact** with the booking ID.
$md$,
  updated_at = now()
WHERE slug = 'vendor-payment-documents';

-- VENDOR_END

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
UPDATE public.help_articles
SET
  title = 'Sign in and use the admin console',
  summary = 'Open the console, move around, and sign out.',
  body_md = $md$
Please sign in at **Login**, then go to the admin dashboard. Legacy admin login links still work and take you to the same place.

### 1. Sign in
Please open the Eventtz login page, then sign in with an account whose user type is **admin**. You land on the dashboard.

The sidebar (desktop) or menu (mobile) includes Dashboard, Commerce, Directory, Referrals, Messages, Report a bug, Blog, Trust and safety, Settings, Team, and Activity log. **Email health** appears only for **super admins**. Your role label shows as **Support admin** or **Super admin**.

Please use **Sign out** in the shell. You return to the login page.

Use the **?** help button (bottom right) for walkthrough articles and the admin assistant. For product bugs, use **Report a bug**.
$md$,
  updated_at = now()
WHERE slug = 'admin-sign-in-console';

UPDATE public.help_articles
SET
  title = 'Support admin vs super admin',
  summary = 'What each role can see and change.',
  body_md = $md$
Support admins handle day-to-day review. Super admins can also move money, change team roles, and override listing visibility.

## Support admin

Can:

- View dashboard, commerce lists, financials summary, marketplace analytics
- Approve, pending, or ban vendors; set listing back to **Automatic**; suspend or unsuspend clients
- Triage disputes (status, assign, party notes); hide or unhide reviews
- Please send support messages to **selected users**; use Blog CMS
- Read Team roster and Activity log

Can't:

- Run booking money or recovery actions
- Please resolve disputes with refunds or payouts
- Force **Publish anyway** or **Hide listing**
- Broadcast messages to all clients, vendors, or users
- Restore payout account from history
- Invite or change admin team roles
- Open Email testing
- Export financials spreadsheet

## Super admin

Everything a support admin can do, plus **Publish anyway** and **Hide listing**, audience broadcasts, **Restore from payout transfer**, booking **Support actions**, dispute financial resolve, team invite and role changes, email testing, and financials spreadsheet export.

See **Publish anyway, hide listing, and automatic** for listing modes. See **Return a vendor profile for edits** and **Email draft vendors** for directory workflows.
$md$,
  updated_at = now()
WHERE slug = 'admin-roles-explained';

UPDATE public.help_articles
SET
  title = 'Dashboard at a glance',
  summary = 'Key numbers, things that need attention, and charts.',
  body_md = $md$
You can open **Dashboard** in the admin sidebar.

You will see key numbers such as pending vendor approvals, active bookings, and paid bookings; **Needs attention** for pending vendors, open disputes, and bookings needing help; and charts for signups and bookings (pick a time range such as 7 or 30 days).

Tap attention items to jump into Directory, Trust, or Commerce. Start each shift here so you don't miss approvals or open disputes.
$md$,
  updated_at = now()
WHERE slug = 'admin-dashboard-overview';

UPDATE public.help_articles
SET
  title = 'Review and approve vendors',
  summary = 'Use the checklist, then approve, pending, ban, or return for edits.',
  body_md = $md$
Please open **Directory > Vendors**. Search or filter (try **submitted** plus **pending** for new applications), then open a vendor and read the **submission checklist**.

> [!NOTE]
> Approval isn't the same as **Browse** visibility or payout setup. The vendor still needs **Payments** ready before they can accept paid bookings.

- **Approved.** Vendor can go live on Browse when listing rules allow.
- **Pending.** Stays off the marketplace while you review.
- **Banned.** Blocked from the marketplace.
- **Return for edits.** Unlock the profile and send them a fix list.

Approval isn't the same as Browse visibility or payout setup. Please use **Publish anyway / hide listing** when you need manual control (super admin). Changes are recorded in the **Activity log**.
$md$,
  updated_at = now()
WHERE slug = 'admin-approve-vendors';

UPDATE public.help_articles
SET
  title = 'Suspend or restore client accounts',
  summary = 'Directory Clients: suspend and unsuspend accounts.',
  body_md = $md$
Please open **Directory > Clients**. Search by email or filter suspended accounts, open the client, then **Suspend** or **unsuspend** with confirmation.

Please use suspend for abuse or policy breaches. Prefer clear notes in related disputes when relevant.
$md$,
  updated_at = now()
WHERE slug = 'admin-suspend-clients';

UPDATE public.help_articles
SET
  title = 'Find and open bookings',
  summary = 'Commerce Bookings list and booking detail.',
  body_md = $md$
Please open **Commerce > Bookings**. Filter by status, search, date range, or rows that need attention, then click a row for the detail page.

> [!NOTE]
> Any admin can **view**. Money buttons on the booking are **super admin** only.

You will see parties, amounts, payment status, dates, and linked review or dispute when relevant.
$md$,
  updated_at = now()
WHERE slug = 'admin-find-bookings';

UPDATE public.help_articles
SET
  title = 'Booking support actions (super admin)',
  summary = 'Check payment, pay vendor, complete, cancel. Payout may stay held until payout setup is ready.',
  body_md = $md$
**Super admin** only. Support admins can view and ask a super admin for help.

> [!IMPORTANT]
> Please confirm payment state before moving money. Please prefer the smallest fix first. Every action is recorded in the Activity log.

Please open a booking, then **Support actions**.

- **Check payment.** Refresh payment status.
- **Unblock payment.** Clear a stuck payment page.
- **Pay vendor.** Release or retry paying the vendor when appropriate.
- **Finish cancellation.** Complete a stuck cancel.
- **Mark complete** for client and/or vendor when needed.
- **Pause / resume payment** to the vendor.
- **Re-run checks.**
- **Cancel on behalf.** Choose who and enter a reason (at least 3 characters).

## Held payouts

If both parties confirmed completion but the vendor has not finished payout setup, the payout stays **held**. Please ask the vendor to open **Payments** and finish setup. Then retry **Pay vendor** if it is still waiting.
$md$,
  updated_at = now()
WHERE slug = 'admin-booking-support-actions';

UPDATE public.help_articles
SET
  title = 'Pause paying the vendor',
  summary = 'Hold automatic payment while you investigate.',
  body_md = $md$
**Super admin.** Use while looking into a dispute or incomplete event before money should move.

> [!WARNING]
> Pausing payment stops automatic payout to the vendor. Please resume only when investigation is complete.

### 1. Open the booking
Please open the booking and **Pause payment** to the vendor.

### 2. Investigate, then resume
Please investigate using Disputes, Messages, and booking chat. **Resume** when it is safe for payment rules to continue.
$md$,
  updated_at = now()
WHERE slug = 'admin-support-hold';

UPDATE public.help_articles
SET
  title = 'Read platform financials',
  summary = 'Commerce Financials: spend, fees, and charts.',
  body_md = $md$
Please open **Commerce > Financials**. Any admin can pick a time period, read totals such as client spend, platform fee percentage, and paid booking count, and view charts for spend, fees, and volume.

Downloading financials is **super admin** only when that control is available. Downloads are recorded in the Activity log.
$md$,
  updated_at = now()
WHERE slug = 'admin-read-financials';

UPDATE public.help_articles
SET
  title = 'Marketplace analytics',
  summary = 'Funnel metrics plus enquiry reminder and client nudge counts.',
  body_md = $md$
Please open **Commerce > Marketplace**.

Please look at steps from request to accept to pay to complete, conversion rates, how fast vendors reply to new enquiries, enquiry reminder counts, client nudges when vendors don't reply within 24 hours, ratings and profile views, why bookings fail when that is shown, breakdowns by category and place, and top vendors when shown.

You can use this to spot slow replies and drop-offs after accept.
$md$,
  updated_at = now()
WHERE slug = 'admin-marketplace-analytics';

UPDATE public.help_articles
SET
  title = 'Triage disputes',
  summary = 'Assign, update status, and leave notes for each party.',
  body_md = $md$
Please open **Trust and safety > Disputes**. Any admin can filter by status (open, under review, resolved, closed), open a dispute, **assign** (including to yourself), change status, write notes the client and/or vendor can see, and open related booking chat when needed.

> [!NOTE]
> Paying the vendor or refunding the client is **super admin** only. Please leave a clear recommendation in notes for them.
$md$,
  updated_at = now()
WHERE slug = 'admin-triage-disputes';

UPDATE public.help_articles
SET
  title = 'Resolve disputes with money (super admin)',
  summary = 'Pay the vendor, full refund, or partial refund.',
  body_md = $md$
**Super admin** only. Finish review and notes, then choose an outcome.

> [!IMPORTANT]
> Money outcomes are final for that dispute. Please confirm amounts and leave notes before you resolve.

- **Pay the vendor.**
- **Full refund to the client.**
- **Partial refund.** Enter the amount in pounds.

Please resolve so the dispute is marked resolved. Support admins should assign a super admin and leave a clear recommendation in notes.
$md$,
  updated_at = now()
WHERE slug = 'admin-resolve-dispute-money';

UPDATE public.help_articles
SET
  title = 'Moderate reviews',
  summary = 'Hide or show public vendor reviews.',
  body_md = $md$
Please open **Trust and safety > Reviews**, then open a review. **Hide** it from the public profile or **show** it again when appropriate.

Please use hide for abuse or policy breaches. Actions are recorded in the Activity log.
$md$,
  updated_at = now()
WHERE slug = 'admin-moderate-reviews';

UPDATE public.help_articles
SET
  title = 'Support inbox',
  summary = 'Read, reply, and mark conversations.',
  body_md = $md$
Please open **Messages > Inbox**. Open unread conversations, read the thread, **Reply** as Eventtz Support, and mark read when done.

Please prefer clear replies and include booking IDs when useful.
$md$,
  updated_at = now()
WHERE slug = 'admin-support-inbox';

UPDATE public.help_articles
SET
  title = 'Compose and send messages',
  summary = 'Message selected people or all clients / vendors.',
  body_md = $md$
Please open **Messages > Compose**.

- **Selected users** (directory search): any support admin.
- **All clients**, **All vendors**, or **All users**: **super admin only**.

### 1. Choose audience
Please pick who receives it.

### 2. Write and send
Please write the message, then send. This creates support conversations.

> [!WARNING]
> Broadcasts are audited. Please double-check audience before sending platform-wide messages.
$md$,
  updated_at = now()
WHERE slug = 'admin-compose-broadcast';

UPDATE public.help_articles
SET
  title = 'Manage blog posts',
  summary = 'Create, edit, publish, and remove posts.',
  body_md = $md$
Please open **Blog** in the sidebar. Create or open a post, then edit title, subtitle, web address, author name, cover image, and body.

**Save** as draft, **Publish** when ready, or **unpublish**. **Delete** only when you mean it. Published posts appear on the public blog.
$md$,
  updated_at = now()
WHERE slug = 'admin-blog-cms';

UPDATE public.help_articles
SET
  title = 'Invite and manage the admin team',
  summary = 'Super admin: invite, change roles, suspend admins.',
  body_md = $md$
Please open **Team**. Any admin can view who is on the team and their role.

**Super admin** only: **Invite** a new admin, change role between support admin and super admin, and **Suspend** or reactivate (not yourself).

The system protects against removing the last super admin. Support admins should ask a super admin for team changes.
$md$,
  updated_at = now()
WHERE slug = 'admin-team-manage';

UPDATE public.help_articles
SET
  title = 'Use the activity log',
  summary = 'Filter and inspect recorded admin actions.',
  body_md = $md$
Please open **Activity log**. Filter to bookings, clients, vendors, disputes, reviews, chat, financials, team, and more.

Please open an entry for details and related IDs. Follow links to bookings or disputes when shown. Use the log after money moves, approvals, suspensions, and team changes.
$md$,
  updated_at = now()
WHERE slug = 'admin-activity-log';

UPDATE public.help_articles
SET
  title = 'Send test emails',
  summary = 'Super admin Email testing.',
  body_md = $md$
**Super admin** only. Open **Email health**.

Please pick a category (Marketing, Account, Booking, Admin alerts), choose a template, enter a recipient, and send a test.

Please use your own inbox for checks. Please don't spam real customers. Tests are recorded in the Activity log.
$md$,
  updated_at = now()
WHERE slug = 'admin-email-testing';

UPDATE public.help_articles
SET
  title = 'Review a submitted vendor profile',
  summary = 'Open a vendor, read the checklist, then approve, return for edits, or ban.',
  body_md = $md$
Please open **Directory > Vendors**. Filter **Profile > submitted** and **Approval > pending** when triaging new applications.

Please open a vendor to see their full application and a **checklist** of required items (photos, packages, bio, policies, and similar).

- **Approve** when the profile is ready.
- **Return for edits** when they can fix issues and resubmit.
- Leave **pending** while you are still reviewing.

See **Return for edits**, **Publish anyway / Hide listing**, and **Email draft vendors** for the next step.
$md$,
  updated_at = now()
WHERE slug = 'admin-vendor-submission-review';

UPDATE public.help_articles
SET
  title = 'Return a vendor profile for edits',
  summary = 'Unlock a submitted profile, email the vendor, and send an Eventtz Support message.',
  body_md = $md$
You can use this when the vendor submitted but the checklist shows missing or weak items you want them to fix themselves.

Please open **Directory > Vendors**, open the vendor, then **Return for edits**.

### 1. Review the message
The pre-filled message lists missing checklist items automatically. Edit it if needed.

### 2. Return and send
Please click **Return and send message**.

The profile goes back to **draft** so they can edit **Profile**. They receive an **email** with your message and a link, and the same text in **Eventtz Support**. When they fix the issues, they submit again. You review from the same Directory list.
$md$,
  updated_at = now()
WHERE slug = 'admin-return-for-edits';

UPDATE public.help_articles
SET
  title = 'Email draft vendors to complete profile',
  summary = 'Select draft vendors and send a reminder email to finish and submit.',
  body_md = $md$
Please open **Directory > Vendors**. Filter **Profile > draft**.

### 1. Select draft vendors
Please tick the checkboxes (or select all draft on the page).

### 2. Send the reminder
Please click **Send complete profile email**. The toast shows how many emails sent, skipped, or failed.

Only vendors still in **draft** get the email. Submitted or approved vendors are skipped. Failures usually mean no email address on the user account. Check the vendor row before retrying.
$md$,
  updated_at = now()
WHERE slug = 'admin-nudge-draft-vendors';

UPDATE public.help_articles
SET
  title = 'Publish anyway, hide listing, and automatic',
  summary = 'Control whether approved vendors appear on Browse.',
  body_md = $md$
On an approved vendor in **Directory > Vendors**:

- **Automatic.** Default rules apply (approval, payout setup, and profile completeness).
- **Publish anyway.** Show on Browse even when automatic rules would hide them (**super admin** only).
- **Hide listing.** Keep them off Browse even if payouts are ready (**super admin** only).

**Support admin** can set listing back to **Automatic** only.

**Hide listing** only affects Browse visibility. It does not remove payout account details.

If a vendor was paid before but their payout account looks missing in the console, open the vendor **Actions** tab and use **Restore from payout transfer** when shown. This copies the account from their latest payout record. Use this when payout details were cleared by mistake, not for routine listing changes.
$md$,
  updated_at = now()
WHERE slug = 'admin-listing-visibility';

UPDATE public.help_articles
SET
  title = 'Referral partners and signup links',
  summary = 'Create partners, copy register links, and see who signed up.',
  body_md = $md$
Please open **Referrals** in the admin sidebar.

### 1. Create a partner
Please add a partner name (and notes if you use them).

### 2. Share the link
Please copy the **vendor register** link and share it with the partner.

Open a partner to see vendors who registered through that link. Attribution is recorded on first signup from the link. Referrals do not change vendor approval or payout rules. They are for tracking and partner relationships only.
$md$,
  updated_at = now()
WHERE slug = 'admin-referral-partners';

UPDATE public.help_articles
SET
  title = 'Report a bug',
  summary = 'Send a staff bug report from the console.',
  body_md = $md$
Please use **Report a bug** in the sidebar when something in the console is broken. You can also use it when Help cannot answer.

Please include what you expected, what happened, a booking ID, vendor, or client if it is about a live case, and screenshots if they help.

This always files as a bug report. It does not classify the subject with AI.

Please open **Settings** to change your admin password. Test accounts on that page are for internal QA only. Please don't share those passwords in Help or Messages.
$md$,
  updated_at = now()
WHERE slug = 'admin-report-bug';

UPDATE public.help_articles
SET
  title = 'When a user deletes their account',
  summary = 'Listings hide, personal details are removed, booking history stays.',
  body_md = $md$
Clients and vendors can close their own account from **Settings** with their password. Admins can't delete their own admin login this way.

> [!NOTE]
> Please don't try to remove the user record. The account stays as a deleted placeholder on purpose so the other party keeps their booking history.

You will see **Deleted user** on bookings, chats, and reviews; vendor listings hidden from Browse; email, phone, and other personal details stripped; and shared bookings, chats, reviews, and disputes still in place.

They can't delete while money is still moving, an accepted event is still ahead, or a dispute is open. If a payout is held because payout setup was incomplete, that still needs a payout or support action. See **Booking support actions**.
$md$,
  updated_at = now()
WHERE slug = 'admin-deleted-accounts';
