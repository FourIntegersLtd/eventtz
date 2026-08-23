-- Help Center: add NOTE / WARNING / IMPORTANT callouts to high-impact articles.
-- Run after 080. UPDATE only. No deletes.

-- ---------------------------------------------------------------------------
-- Client
-- ---------------------------------------------------------------------------
UPDATE public.help_articles
SET
  body_md = $md$
Everything stays in one place from first browse to payment. You do not pay until the vendor accepts, and the date is not held until you pay.

> [!NOTE]
> You can message several vendors at once, but only **pay** the booking you want to keep.

### 1. Browse and choose
Open **Browse** (or **Plan my event** for AI ideas). Check packages, reviews, and prices. Save favourites with the heart icon. Several vendors for the same celebration can sit together on **Bookings** and **Dashboard**.

### 2. Send a request
Pick a package or service, add your date and venue if you have them, and send a booking request. Track it under **Bookings**. You can enquire with more than one vendor until you pay.

### 3. Agree the details
Use **Messages** to agree scope and price. The vendor may send an updated price. Accept or decline from the booking page.

### 4. Pay after they accept
When the vendor accepts, pay from the booking page. You see the full total, including the Eventtz fee, before you confirm.

### 5. After the event
Confirm completion if it went well so the vendor can be paid. If something went wrong, open **Disputes** instead.
$md$,
  updated_at = now()
WHERE slug = 'client-how-booking-works';

UPDATE public.help_articles
SET
  body_md = $md$
Use this when you want options before you choose. You are not charged to ask. You only pay after a vendor accepts and you complete payment on that booking.

> [!NOTE]
> Each vendor gets a separate request. Cancel the ones you no longer need so everyone knows where they stand.

### 1. Select vendors
On **Browse** or **Favourites**, select more than one vendor.

### 2. Send one shared brief
Open the multi-ask flow and fill one shared brief (date, place, notes). Send. Each vendor gets their own request with that brief.

## What happens next

- Chat with each vendor separately.
- Compare replies and prices.
- Pay only the one you choose after they accept.
- Cancel or leave the others when you no longer need them.
$md$,
  updated_at = now()
WHERE slug = 'client-multi-enquire';

UPDATE public.help_articles
SET
  body_md = $md$
While you are still deciding, a vendor may send a custom quote from chat, or a price update for extras or a discount.

> [!NOTE]
> Read the new total carefully. You only pay after you **accept** the price and the vendor has accepted the booking.

### 1. Open the booking
Open the booking under **Bookings** and read the new total carefully.

### 2. Accept or decline
**Accept** if you agree, or **Decline** if you do not.

You only pay after you and the vendor agree the price, and they have accepted the booking. If you decline, keep chatting or cancel that request if you are done with that vendor.
$md$,
  updated_at = now()
WHERE slug = 'client-accept-quote';

UPDATE public.help_articles
SET
  body_md = $md$
You pay **after the vendor accepts**. Asking does not cost anything. The date is **not held** until payment goes through.

> [!NOTE]
> The full total, including the **5% Eventtz fee**, is shown on the payment page before you confirm.

### 1. Open the accepted booking
Open it under **Bookings** and tap **Pay**.

### 2. Check the total and pay
Check the full total (packages, agreed changes, and the Eventtz fee), then pay securely on the payment page.

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
  body_md = $md$
When you pay, Eventtz holds the money. The vendor is not paid the moment you pay. You pay on a secure payment page. Eventtz does not keep your full card number.

> [!NOTE]
> Your money stays protected until the event is done and any problems are resolved.

Money can be released when you and the vendor both say the event went well, or about **48 hours** after the event if nobody reports a problem.

If there is a problem, report it from the booking (**Disputes**). We can pause paying the vendor while we look into it.
$md$,
  updated_at = now()
WHERE slug = 'client-payment-safe';

UPDATE public.help_articles
SET
  body_md = $md$
If something serious went wrong (no-show, major quality issue, safety concern), report it from the booking so we can pause paying the vendor and review.

> [!IMPORTANT]
> Open a **dispute** instead of confirming the event went well. Confirming tells us the booking finished successfully.

### 1. Open the booking
Open it under **Bookings**, or go to **Disputes** in the menu.

### 2. Report the problem
Choose to report a problem / open a dispute. Explain what happened and add photos if you can.

We review the case and may **pause paying the vendor** until it is sorted. Check the dispute for updates.

Disputes are not for simple how-to questions (use Help or **Contact**) or changing your mind before the event when cancel still works.
$md$,
  updated_at = now()
WHERE slug = 'client-report-problem';

UPDATE public.help_articles
SET
  body_md = $md$
Until you pay, phone and email are often hidden so you chat inside Eventtz.

> [!NOTE]
> After you pay, contact details may appear so you can coordinate by phone or email for the event.

Once you have paid, contact details may become visible so you can coordinate by phone or email. Venue details you added on the booking are for the vendor when you provided them.

Under **Settings**, check sharing preferences. Change them if you want stricter sharing.
$md$,
  updated_at = now()
WHERE slug = 'client-contact-sharing';

UPDATE public.help_articles
SET
  body_md = $md$
Download a receipt for a paid booking, or browse everything you have paid, refunded, or paid out.

> [!NOTE]
> Receipts appear only after payment succeeds. Use the booking ID in **Contact** if a paid receipt is missing.

Open **Payment history** from your portal, or from a paid booking. On a paid booking, open **Payment receipt**. You can view it on screen and download or print the page. The receipt shows the event, amounts (including the Eventtz fee), and payment status.

Receipts appear after payment succeeds. If you paid and still cannot see one, use **Contact** and include the booking ID.
$md$,
  updated_at = now()
WHERE slug = 'client-payment-receipts';

UPDATE public.help_articles
SET
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
  body_md = $md$
After a completed booking, we may ask you to leave a review. Honest reviews help other clients and good vendors.

> [!NOTE]
> If you have an open **dispute**, wait until it is resolved before leaving a review.

- Be fair and specific (timing, quality, communication).
- You can attach up to **five photos** of the event.
- If you have an open dispute, sort that first.

You may find past reviews under **Settings** when that section is shown.
$md$,
  updated_at = now()
WHERE slug = 'client-leave-review';

UPDATE public.help_articles
SET
  body_md = $md$
Close your Eventtz account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details.

> [!IMPORTANT]
> Deleting your account is permanent. Finish or cancel open bookings before you continue.

> [!WARNING]
> This cannot be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. The other person on a booking still sees the date, venue, and amounts.

## Before you start

You will need your current password.

You cannot delete yet if:

- **Payment in progress.** Finish payout or wait for a refund.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

## Delete your account

### 1. Open Settings
From the client area, select **Settings**, then **Account**.

### 2. Confirm and delete
Tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account. The other person still has the booking contract, and your name shows as a deleted user.
$md$,
  updated_at = now()
WHERE slug = 'client-delete-account';

-- ---------------------------------------------------------------------------
-- Vendor
-- ---------------------------------------------------------------------------
UPDATE public.help_articles
SET
  body_md = $md$
Join as a vendor, finish your profile, and submit for review. You do not need to set up payments to submit or to appear on Browse after approval.

> [!NOTE]
> Finish **Payments** before you **accept** your first paid booking. You can submit your profile without it.

### 1. Create your account
Open **Vendor register** and create your account.

### 2. Complete Profile
Sign in and open **Profile**. Complete each step (business basics, services, place, prices, photos, policies, review).

### 3. Submit for review
Tap **Submit for review**. Our team reviews your listing. When you are approved, clients can find you on Browse.

Set up how you get paid when you are ready to **accept** your first booking, or anytime under **Payments**.
$md$,
  updated_at = now()
WHERE slug = 'vendor-how-to-join';

UPDATE public.help_articles
SET
  body_md = $md$
Open **Profile** and work through each step. Progress saves as you go.

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
  body_md = $md$
Going live is three separate things.

> [!NOTE]
> Approval and **Browse** visibility do not mean payout setup is done. Finish **Payments** before you accept a paid booking.

### 1. Submit and get approved
Finish **Profile** and **Submit for review**. Our team approves when the listing meets our standards.

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
  body_md = $md$
You cannot accept a client booking until how you get paid is ready. That way money can move safely after the event.

> [!WARNING]
> If payout setup is not finished when a booking is ready to pay out, we **hold** the money until you complete it.

Open **Payments**, or follow the prompt when you try to **accept** a booking.

### 1. Start payout setup
Start from **Payout account**.

### 2. Complete identity and bank details
Finish the steps with our payments partner, then return to Eventtz and wait until setup shows as ready.

If payout setup is still open about **24 hours** after we approve you, we email a reminder to finish it.

When everyone confirms (or about **48 hours** after the event with no problem), money goes to your bank on the payments partner's schedule. If both sides confirmed but payout setup is not ready, we **hold** the payout until you finish it.
$md$,
  updated_at = now()
WHERE slug = 'vendor-stripe-payouts';

UPDATE public.help_articles
SET
  body_md = $md$
Respond from **Bookings**. Faster replies win more bookings. We remind you if a request is still waiting, usually after about **1 hour**, **6 hours**, and **24 hours**.

> [!NOTE]
> The date is **not confirmed** for the client until they pay. Accept quickly, then watch for their payment.

### 1. Open the request
Open **Bookings**, then the pending request. Read the date, place, packages, and notes. Chat if you need clarity.

### 2. Accept or decline
**Accept** or **Decline**. If how you get paid is not ready, Eventtz will ask you to finish bank setup first. After you return from the payments partner, open the booking again to accept.

After you accept, the client can pay. The date is not confirmed for them until they pay. Watch **Messages** and **Notifications**.
$md$,
  updated_at = now()
WHERE slug = 'vendor-accept-booking';

UPDATE public.help_articles
SET
  body_md = $md$
From a message thread you can send a **custom quote** with event details and a price. It creates a booking the client can review, accept, and pay.

> [!NOTE]
> Put the agreed total on the booking, not only in chat. The client pays from the booking page.

Use it when a client messaged you without a full request form, you agreed a bespoke package in chat, or you want a clear total on a booking, not only chat text.
$md$,
  updated_at = now()
WHERE slug = 'vendor-custom-quote';

UPDATE public.help_articles
SET
  body_md = $md$
On a pending booking you can send a new price (extras or discounts).

> [!NOTE]
> The client must **accept** the new total before they pay. Explain changes in chat so they are not surprised.

### 1. Create the update
Open the booking and create the update with clear line items.

### 2. Send it
Send it to the client and wait for them to **accept** or **decline**.

The client pays only after the agreed total is accepted and you have accepted the booking (when those steps apply). Explain price changes in chat so the client is not surprised.
$md$,
  updated_at = now()
WHERE slug = 'vendor-price-update';

UPDATE public.help_articles
SET
  body_md = $md$
### 1. Confirm after a paid event
Open the booking and confirm **completion** when the work is done. The client should confirm too when asked.

When both of you confirm, payout can start sooner. If nobody reports a problem, money can be released about **48 hours** after the event.

If payout setup is not finished, we hold the payout until you complete it in **Payments**.

## Cancelling

> [!WARNING]
> Cancelling a **paid** booking may trigger a refund to the client. Check the buttons on that booking before you confirm.

Use cancel on the booking when it is allowed. Rules differ for unpaid requests vs paid bookings. Check the buttons on that booking.

If the client had already paid and a refund is due, Eventtz handles the refund for that booking state. Use **Contact** if something looks stuck.
$md$,
  updated_at = now()
WHERE slug = 'vendor-complete-cancel';

UPDATE public.help_articles
SET
  body_md = $md$
The client pays after you accept. Eventtz holds the money. After the event, you and/or the client confirm it went well. If there is no problem, money can also release about **48 hours** after the event. Then money goes to your bank on the payments partner's schedule.

> [!NOTE]
> If both of you confirmed but **Payments** is not ready, we hold the payout until you finish setup.

When **both** of you confirm, payout can start sooner. We also send an **event tomorrow** reminder the day before a paid booking.

## If payout is held

If you and the client both confirmed but how you get paid is not ready, we hold the payout and notify you. Open **Payments** and finish payout setup so we can send the funds.

Other delays include an open dispute, paused payment, or bank checks still in progress. Check **Payments** and the booking. Use **Contact** with the booking ID if money is late after it should have been released.
$md$,
  updated_at = now()
WHERE slug = 'vendor-when-get-paid';

UPDATE public.help_articles
SET
  body_md = $md$
You or the client can report a problem from the booking. Eventtz reviews it and may **hold payment** until it is sorted.

> [!IMPORTANT]
> Reply quickly with facts and photos. Payment may stay on hold until the dispute is resolved.

### 1. Open the dispute
Open **Disputes** or the booking dispute section.

### 2. Reply with facts
Reply quickly with facts and evidence. Stay professional in the thread.

Our team may leave things as they are, issue a partial refund, or take other actions depending on the case. You will see notes on the dispute when available. Keep serious money issues in Eventtz so there is a clear record.
$md$,
  updated_at = now()
WHERE slug = 'vendor-dispute';

UPDATE public.help_articles
SET
  body_md = $md$
Close your vendor account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details, and your listing leaves Browse.

> [!IMPORTANT]
> Deleting your account is permanent. Finish open bookings and payouts before you continue.

> [!WARNING]
> This cannot be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. Clients still see the date, venue, and amounts.

## Before you start

You will need your current password.

You cannot delete yet if:

- **Payment or payout in progress.** Finish it first.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

Closing the account also closes payout setup with our payments partner. A new registration starts payout setup again.

### 1. Open Settings
From the vendor area, select **Settings**, then **Account**.

### 2. Confirm and delete
Tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account.
$md$,
  updated_at = now()
WHERE slug = 'vendor-delete-account';

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
UPDATE public.help_articles
SET
  body_md = $md$
Open **Commerce > Bookings**. Filter by status, search, date range, or rows that need attention, then click a row for the detail page.

> [!NOTE]
> Any admin can **view**. Money buttons on the booking are **super admin** only.

You will see parties, amounts, payment status, dates, and linked review or dispute when relevant.

Any admin can **view**. Money buttons are **super admin** only.
$md$,
  updated_at = now()
WHERE slug = 'admin-find-bookings';

UPDATE public.help_articles
SET
  body_md = $md$
Open **Directory > Vendors**. Search or filter (try **submitted** plus **pending** for new applications), then open a vendor and read the **submission checklist**.

> [!NOTE]
> Approval is not the same as **Browse** visibility or payout setup. The vendor still needs **Payments** ready before they can accept paid bookings.

- **Approved.** Vendor can go live on Browse when listing rules allow.
- **Pending.** Stays off the marketplace while you review.
- **Banned.** Blocked from the marketplace.
- **Return for edits.** Unlock the profile and send them a fix list.

Approval is not the same as Browse visibility or payout setup. Use **Publish anyway / hide listing** when you need manual control (super admin). Changes are recorded in the **Activity log**.
$md$,
  updated_at = now()
WHERE slug = 'admin-approve-vendors';

UPDATE public.help_articles
SET
  body_md = $md$
**Super admin** only. Support admins can view and ask a super admin for help.

> [!IMPORTANT]
> Confirm payment state before moving money. Prefer the smallest fix first. Every action is recorded in the Activity log.

Open a booking, then **Support actions**.

- **Check payment.** Refresh payment status.
- **Unblock payment.** Clear a stuck payment page.
- **Pay vendor.** Release or retry paying the vendor when appropriate.
- **Finish cancellation.** Complete a stuck cancel.
- **Mark complete** for client and/or vendor when needed.
- **Pause / resume payment** to the vendor.
- **Re-run checks.**
- **Cancel on behalf.** Choose who and enter a reason (at least 3 characters).

## Held payouts

If both parties confirmed completion but the vendor has not finished payout setup, the payout stays **held**. Ask the vendor to open **Payments** and finish setup. Then retry **Pay vendor** if it is still waiting.

Prefer the smallest fix first. Confirm payment state before moving money. Actions are recorded in the Activity log.
$md$,
  updated_at = now()
WHERE slug = 'admin-booking-support-actions';

UPDATE public.help_articles
SET
  body_md = $md$
**Super admin.** Use while looking into a dispute or incomplete event before money should move.

> [!WARNING]
> Pausing payment stops automatic payout to the vendor. Resume only when investigation is complete.

### 1. Open the booking
Open the booking and **Pause payment** to the vendor.

### 2. Investigate, then resume
Investigate using Disputes, Messages, and booking chat. **Resume** when it is safe for payment rules to continue.
$md$,
  updated_at = now()
WHERE slug = 'admin-support-hold';

UPDATE public.help_articles
SET
  body_md = $md$
Open **Trust and safety > Disputes**. Any admin can filter by status (open, under review, resolved, closed), open a dispute, **assign** (including to yourself), change status, write notes the client and/or vendor can see, and open related booking chat when needed.

> [!NOTE]
> Paying the vendor or refunding the client is **super admin** only. Leave a clear recommendation in notes for them.

Paying the vendor or refunding is **super admin** only.
$md$,
  updated_at = now()
WHERE slug = 'admin-triage-disputes';

UPDATE public.help_articles
SET
  body_md = $md$
**Super admin** only. Finish review and notes, then choose an outcome.

> [!IMPORTANT]
> Money outcomes are final for that dispute. Confirm amounts and leave notes before you resolve.

- **Pay the vendor.**
- **Full refund to the client.**
- **Partial refund.** Enter the amount in pounds.

Resolve so the dispute is marked resolved. Support admins should assign a super admin and leave a clear recommendation in notes.
$md$,
  updated_at = now()
WHERE slug = 'admin-resolve-dispute-money';
