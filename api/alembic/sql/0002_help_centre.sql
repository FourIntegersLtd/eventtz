-- Help centre categories and articles, as the numbered baseline migrations
-- (backend/sql) seeded them. Eventtz's only reference data; loaded by 0002.

INSERT INTO public.help_categories VALUES
	('c1111111-1111-4111-8111-111111111101', 'client-getting-started', 'Getting started', 'Sign up, browse vendors, and we''ll help you find your way around.', 'rocket', 10, 'client', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('c1111111-1111-4111-8111-111111111102', 'client-booking', 'Booking', 'Ask, agree on a price, pay when you''re happy, and confirm after your event.', 'calendar', 20, 'client', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('c1111111-1111-4111-8111-111111111104', 'client-chat', 'Chat & contact sharing', 'Message vendors and share contact details after you pay.', 'message', 40, 'client', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('c1111111-1111-4111-8111-111111111105', 'client-problems', 'Problems & disputes', 'If something goes wrong, please tell us. We''re happy to help.', 'shield', 50, 'client', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('c1111111-1111-4111-8111-111111111106', 'client-account', 'Account', 'Your password, settings, and closing your account if you need to.', 'settings', 60, 'client', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('b1111111-1111-4111-8111-111111111101', 'vendor-join', 'Join & onboarding', 'Create your profile and submit it for our team to review.', 'rocket', 10, 'vendor', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('b1111111-1111-4111-8111-111111111103', 'vendor-bookings', 'Bookings & quotes', 'Accept requests, send quotes, and complete your events.', 'calendar', 30, 'vendor', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('b1111111-1111-4111-8111-111111111105', 'vendor-disputes', 'Disputes & support', 'If there''s a problem, please tell us. We''re here to help.', 'shield', 50, 'vendor', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('b1111111-1111-4111-8111-111111111106', 'vendor-profile', 'Profile & analytics', 'Edit your listing and see how it''s doing.', 'user', 60, 'vendor', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111101', 'admin-getting-started', 'Getting started', 'Sign in and see what each admin role can do.', 'rocket', 10, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111102', 'admin-directory', 'Directory', 'Review vendors and clients in the directory.', 'user', 20, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111105', 'admin-trust', 'Trust & safety', 'Help with disputes and reviews.', 'shield', 50, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111106', 'admin-messages', 'Support messages', 'Support inbox and broadcast messages.', 'message', 60, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111107', 'admin-blog', 'Blog CMS', 'Create and publish blog posts.', 'book', 70, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111109', 'admin-email', 'Email testing', 'Send test emails to check templates (super admin).', 'message', 90, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('b1111111-1111-4111-8111-111111111102', 'vendor-go-live', 'Go live & payouts', 'Get approved and set up how you''d like to get paid.', 'wallet', 20, 'vendor', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111103', 'admin-commerce-bookings', 'Commerce: bookings', 'Find bookings and help with payment actions when needed.', 'calendar', 30, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111104', 'admin-commerce-insights', 'Commerce: money & marketplace', 'Platform money summary and marketplace stats.', 'wallet', 40, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('a1111111-1111-4111-8111-111111111108', 'admin-team-audit', 'Team & activity log', 'Your admin team and activity history.', 'settings', 80, 'admin', true, '2026-09-26 02:13:15.351037+00', '2026-09-26 02:13:15.991055+00'),
	('c1111111-1111-4111-8111-111111111107', 'client-planning', 'Planning', 'Plan your celebration with helpful vendor ideas.', 'sparkles', 15, 'client', true, '2026-09-26 02:13:15.656035+00', '2026-09-26 02:13:15.991055+00'),
	('c1111111-1111-4111-8111-111111111103', 'client-payments', 'Payments & fees', 'When you pay, the 5% fee, referral savings, and how we hold your money.', 'wallet', 30, 'client', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:16.103891+00'),
	('b1111111-1111-4111-8111-111111111104', 'vendor-earnings', 'Earnings', 'Fees, referral links for clients, payouts, and payment documents.', 'wallet', 40, 'vendor', true, '2026-09-26 02:13:15.307451+00', '2026-09-26 02:13:16.103891+00'),
	('a1111111-1111-4111-8111-111111111110', 'admin-referrals', 'Referrals', 'Referral partners and vendor signup links.', 'user', 25, 'admin', true, '2026-09-26 02:13:15.656035+00', '2026-09-26 02:13:15.991055+00'),
	('b1111111-1111-4111-8111-111111111107', 'vendor-account', 'Account', 'Your settings, notifications, and account options.', 'settings', 70, 'vendor', true, '2026-09-26 02:13:15.909614+00', '2026-09-26 02:13:15.991055+00');

INSERT INTO public.help_articles VALUES
	('b92dc15f-29e9-4c43-8072-8b192890916e', 'c1111111-1111-4111-8111-111111111102', 'client-complete-booking', 'Confirming the event went well', 'Confirm after your event so the vendor can be paid. We''ll remind you the day before too.', '
For a paid booking, we send an **event tomorrow** reminder the day before so you have time, venue, and messages in one place.

### 1. Open the booking
After the event, please open the booking under **Bookings**.

### 2. Confirm it went well
Please confirm it is complete when asked. The vendor should confirm on their side too. When **both** of you confirm, the vendor can be paid sooner.

If nobody reports a problem, money can go to the vendor about **48 hours** after the event.

> [!WARNING]
> If something went wrong, please don''t confirm. Please open a **dispute** from the booking so we can hold the money and review.

After a successful booking you may be asked to leave a review.
', 'client', 50, true, '{client-how-booking-works,client-payment-safe,client-leave-review}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.99437+00'),
	('145fc784-c0c7-4594-a52f-86b1dba1a0a2', 'c1111111-1111-4111-8111-111111111102', 'client-accept-quote', 'Accepting or declining a price', 'Please respond when a vendor sends a new quote or price change.', '
While you are still deciding, a vendor may send a custom quote from chat, or a price update for extras or a discount.

> [!NOTE]
> Please read the new total carefully. You only pay after you **accept** the price and the vendor has accepted the booking.

### 1. Open the booking
Please open the booking under **Bookings** and read the new total carefully.

### 2. Accept or decline
**Accept** if you agree, or **Decline** if you do not.

You only pay after you and the vendor agree the price, and they have accepted the booking. If you decline, keep chatting or cancel that request if you are done with that vendor.
', 'client', 30, true, '{client-how-booking-works,client-when-do-i-pay,client-messaging-vendors}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.993782+00'),
	('3f4b02f6-015e-4f85-afb2-7ed52a1bd356', 'c1111111-1111-4111-8111-111111111101', 'client-create-account', 'Create a client account', 'Sign up and we''ll help you open your portal.', '
Create a client account to browse vendors, send requests, and pay through Eventtz. We''re happy to help you get started.

### 1. Create your account
Please tap **Client register** on Eventtz. Enter your email and choose a password.

### 2. Confirm your email
If we ask you to confirm your email, follow the link we send, then sign in. You will see your **Dashboard**.

We may ask for a **preferred name**. Vendors see this name on your bookings instead of your email. You can change it later in **Settings**.

## What to do next

- You can open **Browse** to find vendors.
- Save people you like with the heart (**Favourites**).
- Please send a request when you are ready to book.
', 'client', 5, true, '{client-browse-vendors,client-account-settings,client-password-reset}', '2026-09-26 02:13:15.328992+00', '2026-09-26 02:13:15.992156+00'),
	('9279008a-b502-4e7e-8567-5dda7f026e60', 'c1111111-1111-4111-8111-111111111106', 'client-account-settings', 'Account settings', 'Your name, password, sharing, notifications, and account options.', '
Please open **Settings** in the client area. There are three tabs: **Account**, **Privacy**, and **More**.

- **Preferred name.** Shown to vendors on bookings.
- **Password.** Change while signed in.
- **Delete account.** Permanently close the account. See **Delete your account**.
- **Contact sharing.** Control email and phone sharing.
- **Notifications.** Booking updates and messages.

Please keep your email up to date so you don''t miss pay prompts or the day-before event reminder. Keyboard shortcuts and legal links are under **More**.
', 'client', 20, true, '{client-delete-account,client-password-reset,client-contact-sharing}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.997154+00'),
	('0e6fd9a8-7c1f-4415-8657-c7cf240beede', 'c1111111-1111-4111-8111-111111111101', 'client-favourites', 'Saving vendors to Favourites', 'Keep a shortlist while you compare. No rush.', '
Please tap the **heart** on a vendor to save them. Open **Favourites** anytime to see your list.

- Compare people without losing them in search.
- Ask several saved vendors the same question at once.
- Come back later if you are still deciding.

Favourites stay with your signed-in account. Removing a favourite doesn''t cancel a booking you already started.
', 'client', 20, true, '{client-browse-vendors,client-multi-enquire}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.99288+00'),
	('478990d5-f5c8-4b7d-bc81-e56fab0c7b01', 'c1111111-1111-4111-8111-111111111102', 'client-multi-enquire', 'Asking several vendors at once', 'Send the same brief to more than one vendor. It''s free to ask.', '
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
', 'client', 20, true, '{client-how-booking-works,client-browse-vendors,client-favourites}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.993494+00'),
	('c8a25343-df75-47f2-a2ec-88750d98cb0f', 'c1111111-1111-4111-8111-111111111105', 'client-are-vendors-vetted', 'Are vendors checked?', 'Every vendor finishes setup and we review them before they go live.', '
Every vendor completes a profile. Our team reviews each listing before it appears on Browse.

> [!NOTE]
> Reviews and ratings on a profile are from real clients. Read them alongside the vendor''s packages and photos.

You can also check ratings and written reviews, signs of completed bookings on the profile, and photos and credentials the vendor added.

Checks reduce risk. You should still read the profile and agree details in chat before you pay.
', 'client', 30, true, '{client-browse-vendors,client-how-booking-works,client-leave-review}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.996801+00'),
	('b1efc92c-fc97-42d1-92f4-eed57a34db3d', 'c1111111-1111-4111-8111-111111111102', 'client-leave-review', 'Leaving a review', 'Share a kind, honest review after your booking. You can add up to five photos.', '
After a completed booking, we may ask you to leave a review. Honest reviews help other clients and good vendors.

> [!NOTE]
> If you have an open **dispute**, please wait until it is resolved before leaving a review.

- Please be fair and specific (timing, quality, communication).
- You can attach up to **five photos** of the event.
- If you have an open dispute, sort that first.

You may find past reviews under **Settings** when that section is shown.
', 'client', 60, true, '{client-complete-booking,client-are-vendors-vetted}', '2026-09-26 02:13:15.328992+00', '2026-09-26 02:13:15.994655+00'),
	('0638e2ac-f5b8-457e-bb38-b13d57abce7f', 'c1111111-1111-4111-8111-111111111102', 'client-cancel-refund', 'Cancelling and refunds', 'Cancel before the vendor is paid and you''ll get a full refund.', '
Please open the booking and use **Cancel** when it is allowed.

Common cases:

- You asked but the vendor has not accepted yet.
- They accepted but you have not paid yet.
- You paid, but money has not been released to the vendor yet.

## If you already paid

If you cancel before the vendor is paid, you''ll get a **full refund** to your card. Banks often take **5 to 10 working days** to show it. If the vendor cancels after you paid, we refund you.

> [!NOTE]
> Please don''t use cancel for a problem after the day. Open a **dispute** from the booking so we can pause paying the vendor and help.

Please use **Contact** if something looks wrong.
', 'client', 40, true, '{client-report-problem,client-when-do-i-pay,client-payment-safe}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.994087+00'),
	('bab84f3a-c0f8-4d41-b46a-6b8f781e3ccd', 'c1111111-1111-4111-8111-111111111106', 'client-password-reset', 'Resetting your password', 'Please use Forgot password on the sign-in page.', '
If you are signed in, please open **Settings** and change your password there.

### 1. Open Client login
If you are signed out, please open **Client login** and choose **Forgot password**.

### 2. Use the email link
Please enter your email, then open the link we send (usually valid for about **one hour**). Choose a new password and sign in.

Please check spam if the email is slow. Request a new link if the old one expired. Use **Contact** if you can''t access that email inbox.
', 'client', 10, true, '{client-account-settings,client-create-account}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.996976+00'),
	('63bd7e9c-dbe8-48b3-a85d-9ed106e4f49a', 'c1111111-1111-4111-8111-111111111104', 'client-contact-sharing', 'Sharing phone and email', 'When contact details can be shared after you pay.', '
Until you pay, phone and email are often hidden so you chat inside Eventtz.

> [!NOTE]
> After you pay, contact details may appear so you can coordinate by phone or email for the event.

Once you have paid, contact details may become visible so you can coordinate by phone or email. Venue details you added on the booking are for the vendor when you provided them.

Under **Settings**, please check sharing preferences. Change them if you want stricter sharing.
', 'client', 20, true, '{client-messaging-vendors,client-account-settings,client-when-do-i-pay}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.996076+00'),
	('b29013e9-2b18-4467-a4c0-5db001d2ff55', 'c1111111-1111-4111-8111-111111111103', 'client-service-fee', 'Is there a service fee?', 'Yes, 5% on the vendor total. Referral links can save £10–£15 off that fee.', '
Eventtz adds a **5% fee** on top of the vendor total you see on the booking. That total includes packages plus any surcharges or discounts the vendor adds. There are no surprise extras beyond what the booking already shows.

> [!NOTE]
> The full breakdown is always shown before you send a request or pay. Vendors keep the price you agreed with them.

## Referral savings

If the vendor shared a referral link or code (`?vref=` on their listing), you may save on the **Eventtz fee** (not the vendor''s price):

| Vendor total | Savings off Eventtz fee |
|--------------|-------------------------|
| £400+ | £10 |
| £600+ | £15 |

Enter the code on the booking form, or open the vendor''s share link. The booking page shows the exact fee before you pay.

## Your breakdown

Before you pay you always see:

- **Vendor portion.** What you agreed with the vendor.
- **Eventtz fee.** 5% of the vendor total, minus any referral savings.
- **Total due.** Vendor portion plus the Eventtz fee due.

We do not take a cut out of the vendor''s quote. The fee is paid by you on top.
', 'client', 20, true, '{client-when-do-i-pay,client-payment-safe,client-payment-receipts,vendor-client-referrals}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.106065+00'),
	('ace08d6c-d823-468c-8869-a205ab4a8aa2', 'c1111111-1111-4111-8111-111111111103', 'client-payment-safe', 'Is my payment safe?', 'We hold your money safely until your event is done.', '
When you pay, Eventtz holds the money safely for you. The vendor is not paid the moment you pay. You pay on a secure payment page. Eventtz doesn''t keep your full card number.

> [!NOTE]
> Your money stays protected until the event is done and any problems are resolved.

Money can be released when you and the vendor both say the event went well, or about **48 hours** after the event if nobody reports a problem.

If there is a problem, report it from the booking (**Disputes**). We can pause paying the vendor while we look into it.
', 'client', 30, true, '{client-report-problem,client-complete-booking,client-cancel-refund}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.995527+00'),
	('7a7f0458-2141-49ff-aa4d-c0185dd79f3b', 'c1111111-1111-4111-8111-111111111104', 'client-messaging-vendors', 'Messaging vendors', 'Chat from a vendor profile or from your booking.', '
You can open **Messages** for all chats, start chat from a vendor profile, or open chat from a booking so it stays linked to that event.

Please talk about dates, guest numbers, venue, packages, extras, and price changes. Confirm money changes on the booking when asked.

Please keep important agreements in Eventtz chat or on the booking so both sides have a record.
', 'client', 10, true, '{client-how-booking-works,client-contact-sharing,client-accept-quote}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.995803+00'),
	('3eeb596d-19a4-41dc-9ad3-16bc767a3ec2', 'b1111111-1111-4111-8111-111111111101', 'vendor-how-to-join', 'How do I join Eventtz?', 'Create your profile and submit for review. Bank setup can wait until you''re ready.', '
Join as a vendor, finish your profile, and submit for review. You don''t need to set up payments to submit or to appear on Browse after approval.

> [!NOTE]
> Please finish **Payments** before you **accept** your first paid booking. You can submit your profile without it.

### 1. Create your account
Please open **Vendor register** and create your account.

### 2. Complete Profile
Please sign in and open **Profile**. Complete each step (business basics, services, place, prices, photos, policies, review).

### 3. Submit for review
Please tap **Submit for review**. Our team reviews your listing. When you are approved, clients can find you on Browse.

Set up how you get paid when you are ready to **accept** your first booking, or anytime under **Payments**.
', 'vendor', 10, true, '{vendor-onboarding-steps,vendor-package-quality,vendor-pending-access}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.998277+00'),
	('df0369b1-e654-42e5-b674-b3830c762b70', 'b1111111-1111-4111-8111-111111111103', 'vendor-messages-clients', 'Messaging clients', 'Please use Messages and booking chat to agree details.', '
You can open **Messages** for chats with clients. Booking chat keeps the conversation next to that request.

- Please answer requests quickly.
- Please confirm date, venue, and package in writing.
- Please send price updates on the booking when money changes.
- After payment, use shared contact details only when Eventtz shows them.

Unread counts appear in the menu so you don''t miss replies.
', 'vendor', 50, true, '{vendor-accept-booking,vendor-custom-quote,vendor-contact-support}', '2026-09-26 02:13:15.328992+00', '2026-09-26 02:13:15.999705+00'),
	('94de78a0-1033-4a58-a439-1c79e0de77c9', 'b1111111-1111-4111-8111-111111111103', 'vendor-price-update', 'Updating the price', 'Send extras or discounts while the booking is still pending.', '
On a pending booking you can send a new price (extras or discounts).

> [!NOTE]
> The client must **accept** the new total before they pay. The Eventtz fee is **5% of the full vendor total** after your changes, including surcharges. If they used your referral code, tier savings (£10 at £400+, £15 at £600+) are recalculated on the new total.

### 1. Create the update
Please open the booking and add a clear surcharge or discount with a label.

### 2. Send it
Please send it to the client and wait for them to **accept** or **decline**.

Explain price changes in chat so the client is not surprised. The client pays only after the agreed total is accepted and you have accepted the booking (when those steps apply).
', 'vendor', 20, true, '{vendor-accept-booking,vendor-custom-quote,vendor-no-cut,vendor-client-referrals}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.106523+00'),
	('2cf996a1-f820-41f7-8e4a-bc167aef3bf6', 'b1111111-1111-4111-8111-111111111103', 'vendor-custom-quote', 'Sending a custom quote from Messages', 'Create a booking quote for a client from chat.', '
From a message thread you can send a **custom quote** with event details and a price. It creates a booking the client can review, accept, and pay.

> [!NOTE]
> Please put the agreed total on the booking, not only in chat. The client pays from the booking page.

You can use it when a client messaged you without a full request form, you agreed a bespoke package in chat, or you want a clear total on a booking, not only chat text.
', 'vendor', 30, true, '{vendor-accept-booking,vendor-price-update,vendor-messages-clients}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.999353+00'),
	('929fde53-4c18-4193-bb01-caa23ccb28cd', 'b1111111-1111-4111-8111-111111111103', 'vendor-complete-cancel', 'Completing or cancelling a booking', 'Confirm after paid events. Payout may wait if payout setup isn''t finished yet.', '
### 1. Confirm after a paid event
Please open the booking and confirm **completion** when the work is done. The client should confirm too when asked.

When both of you confirm, payout can start sooner. If nobody reports a problem, money can be released about **48 hours** after the event.

If payout setup isn''t finished, we hold the payout until you complete it in **Payments**.

## Cancelling

> [!WARNING]
> Cancelling a **paid** booking may trigger a refund to the client. Check the buttons on that booking before you confirm.

Please use cancel on the booking when it is allowed. Rules differ for unpaid requests vs paid bookings. Check the buttons on that booking.

If the client had already paid and a refund is due, Eventtz handles the refund for that booking state. Use **Contact** if something looks stuck.
', 'vendor', 40, true, '{vendor-when-get-paid,vendor-dispute,vendor-accept-booking}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.999537+00'),
	('bcec8176-ef14-43ac-b984-6283758105f6', 'b1111111-1111-4111-8111-111111111104', 'vendor-no-cut', 'Does Eventtz take a cut from my earnings?', 'No. Clients pay the 5% fee on top of your full quote, including surcharges.', '
Eventtz does **not** take a cut from your agreed quote. Clients pay a **5% Eventtz fee** on top of the **vendor total** on the booking (packages plus any surcharges or discounts you add). You keep the vendor amount shown on the booking.

> [!NOTE]
> If you share a **client referral link**, savings come off the client''s Eventtz fee only. Your payout is unchanged. See **Share a referral link with clients**.

### Example

If your quote is £400 and the client booked with your referral link at the £400 tier, they pay £400 to you plus a reduced Eventtz fee (£10 instead of £20). Your earnings for that booking are still £400 (unless a dispute changes the outcome).

If you add a £50 travel surcharge, the vendor total becomes £450. The client''s Eventtz fee is 5% of £450, minus any referral tier that still applies.
', 'vendor', 10, true, '{vendor-when-get-paid,vendor-stripe-payouts,vendor-client-referrals,vendor-price-update}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.106319+00'),
	('bf89ec9a-b4f4-4acf-8334-8a524c8af2dd', 'a1111111-1111-4111-8111-111111111103', 'admin-find-bookings', 'Find and open bookings', 'Commerce Bookings list and booking detail.', '
Please open **Commerce > Bookings**. Filter by status, search, date range, or rows that need attention, then click a row for the detail page.

> [!NOTE]
> Any admin can **view**. Money buttons on the booking are **super admin** only.

You will see parties, amounts, payment status, dates, and linked review or dispute when relevant.
', 'admin', 10, true, '{admin-booking-support-actions,admin-support-hold}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.003558+00'),
	('8d6ad5c0-9667-4ff1-b8cf-52af84acd00a', 'a1111111-1111-4111-8111-111111111102', 'admin-approve-vendors', 'Review and approve vendors', 'Use the checklist, then approve, pending, ban, or return for edits.', '
Please open **Directory > Vendors**. Search or filter (try **submitted** plus **pending** for new applications), then open a vendor and read the **submission checklist**.

> [!NOTE]
> Approval isn''t the same as **Browse** visibility or payout setup. The vendor still needs **Payments** ready before they can accept paid bookings.

- **Approved.** Vendor can go live on Browse when listing rules allow.
- **Pending.** Stays off the marketplace while you review.
- **Banned.** Blocked from the marketplace.
- **Return for edits.** Unlock the profile and send them a fix list.

Approval isn''t the same as Browse visibility or payout setup. Please use **Publish anyway / hide listing** when you need manual control (super admin). Changes are recorded in the **Activity log**.
', 'admin', 10, true, '{admin-vendor-submission-review,admin-return-for-edits,admin-listing-visibility,admin-suspend-clients}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.003238+00'),
	('fa64c43a-373a-47a7-8c30-871d1ea2ef26', 'b1111111-1111-4111-8111-111111111105', 'vendor-dispute', 'What happens if there is a dispute?', 'Either side can report a problem. Payment may be held while we help.', '
You or the client can report a problem from the booking. Eventtz reviews it and may **hold payment** until it is sorted.

> [!IMPORTANT]
> Please reply quickly with facts and photos. Payment may stay on hold until the dispute is resolved.

### 1. Open the dispute
Please open **Disputes** or the booking dispute section.

### 2. Reply with facts
Please reply quickly with facts and evidence. Stay professional in the thread.

Our team may leave things as they are, issue a partial refund, or take other actions depending on the case. You will see notes on the dispute when available. Keep serious money issues in Eventtz so there is a clear record.
', 'vendor', 10, true, '{vendor-contact-support,vendor-when-get-paid,vendor-complete-cancel}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.000229+00'),
	('6ae9c82b-c4a1-4dae-93b4-6d46d85e8dcd', 'b1111111-1111-4111-8111-111111111106', 'vendor-edit-profile', 'Editing your live profile', 'Update your services, photos, and availability after approval.', '
Once approved, open **Profile** to update your listing. Save as you go.

Please keep packages and prices, photos, service area and travel, and policies and availability notes current. Big changes may still be reviewed if our team needs to check them.
', 'vendor', 10, true, '{vendor-analytics,vendor-when-live,vendor-onboarding-steps}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.000588+00'),
	('49d629c2-8fb4-40a8-8b92-5434f926811f', 'b1111111-1111-4111-8111-111111111106', 'vendor-analytics', 'Vendor analytics', 'See how your requests turn into bookings.', '
You can open **Analytics** to see how your profile is doing over a period: profile views, requests, accepts and outcomes, and reply-time style metrics when shown.

Please reply faster, keep packages clear and fairly priced, refresh photos, and finish how you get paid so you never block an accept. Use Dashboard reminders together with Analytics to catch unpaid accepts and payout setup.
', 'vendor', 20, true, '{vendor-edit-profile,vendor-accept-booking,vendor-stripe-payouts}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.000841+00'),
	('55520884-7540-4062-9213-d5ba1225d5a5', 'a1111111-1111-4111-8111-111111111102', 'admin-suspend-clients', 'Suspend or restore client accounts', 'Directory Clients: suspend and unsuspend accounts.', '
Please open **Directory > Clients**. Search by email or filter suspended accounts, open the client, then **Suspend** or **unsuspend** with confirmation.

Please use suspend for abuse or policy breaches. Prefer clear notes in related disputes when relevant.
', 'admin', 20, true, '{admin-approve-vendors,admin-activity-log}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.003399+00'),
	('a2a3ac81-bb83-4c28-8bd9-b0e44c8b9026', 'b1111111-1111-4111-8111-111111111105', 'vendor-contact-support', 'Contact Eventtz support', 'Please use Contact for account and payment questions. We''re happy to help.', '
Please use **Contact** in the vendor area. We aim to reply by email within about **two working days**.

Please include your account email, the booking ID for payment or dispute questions, and screenshots for payment setup errors.

- **Help** and **Ask:** how-to questions first.
- **Contact:** account or payout setup problems.
- **Disputes:** active booking problems.
', 'vendor', 20, true, '{vendor-profile-returned,vendor-dispute,vendor-stripe-payouts}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.000392+00'),
	('64b802d1-e256-49e3-84c2-aa20196d5e58', 'a1111111-1111-4111-8111-111111111101', 'admin-dashboard-overview', 'Dashboard at a glance', 'Key numbers, things that need attention, and charts.', '
You can open **Dashboard** in the admin sidebar.

You will see key numbers such as pending vendor approvals, active bookings, and paid bookings; **Needs attention** for pending vendors, open disputes, and bookings needing help; and charts for signups and bookings (pick a time range such as 7 or 30 days).

Tap attention items to jump into Directory, Trust, or Commerce. Start each shift here so you don''t miss approvals or open disputes.
', 'admin', 30, true, '{admin-roles-explained,admin-vendor-submission-review,admin-listing-visibility}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.003072+00'),
	('1b541170-f38f-4133-ba83-18087bd42225', 'a1111111-1111-4111-8111-111111111108', 'admin-activity-log', 'Use the activity log', 'Filter and inspect recorded admin actions.', '
Please open **Activity log**. Filter to bookings, clients, vendors, disputes, reviews, chat, financials, team, and more.

Please open an entry for details and related IDs. Follow links to bookings or disputes when shown. Use the log after money moves, approvals, suspensions, and team changes.
', 'admin', 20, true, '{admin-team-manage,admin-booking-support-actions}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.005644+00'),
	('0548a98a-49a5-45e8-b24b-eb60ff8b9aab', 'a1111111-1111-4111-8111-111111111105', 'admin-moderate-reviews', 'Moderate reviews', 'Hide or show public vendor reviews.', '
Please open **Trust and safety > Reviews**, then open a review. **Hide** it from the public profile or **show** it again when appropriate.

Please use hide for abuse or policy breaches. Actions are recorded in the Activity log.
', 'admin', 30, true, '{admin-triage-disputes,admin-activity-log}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.00481+00'),
	('3b7ef77c-ffd4-4964-b664-cf889f9ba5c2', 'a1111111-1111-4111-8111-111111111106', 'admin-support-inbox', 'Support inbox', 'Read, reply, and mark conversations.', '
Please open **Messages > Inbox**. Open unread conversations, read the thread, **Reply** as Eventtz Support, and mark read when done.

Please prefer clear replies and include booking IDs when useful.
', 'admin', 10, true, '{admin-compose-broadcast,admin-return-for-edits,admin-roles-explained}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.004976+00'),
	('e166b290-589b-4a91-9a30-8f7b68d2c74d', 'a1111111-1111-4111-8111-111111111104', 'admin-read-financials', 'Read platform financials', 'Commerce Financials: spend, fees, and charts.', '
Please open **Commerce > Financials**. Any admin can pick a time period, read totals such as client spend, platform fee percentage, and paid booking count, and view charts for spend, fees, and volume.

Downloading financials is **super admin** only when that control is available. Downloads are recorded in the Activity log.
', 'admin', 10, true, '{admin-marketplace-analytics,admin-roles-explained}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.004071+00'),
	('760ed370-0681-4eb4-88c4-bdffa972f10f', 'a1111111-1111-4111-8111-111111111105', 'admin-triage-disputes', 'Triage disputes', 'Assign, update status, and leave notes for each party.', '
Please open **Trust and safety > Disputes**. Any admin can filter by status (open, under review, resolved, closed), open a dispute, **assign** (including to yourself), change status, write notes the client and/or vendor can see, and open related booking chat when needed.

> [!NOTE]
> Paying the vendor or refunding the client is **super admin** only. Please leave a clear recommendation in notes for them.
', 'admin', 10, true, '{admin-resolve-dispute-money,admin-support-hold}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.004425+00'),
	('75154c11-84c5-4456-8100-9374a86a5e57', 'a1111111-1111-4111-8111-111111111109', 'admin-email-testing', 'Send test emails', 'Super admin Email testing.', '
**Super admin** only. Open **Email health**.

Please pick a category (Marketing, Account, Booking, Admin alerts), choose a template, enter a recipient, and send a test.

Please use your own inbox for checks. Please don''t spam real customers. Tests are recorded in the Activity log.
', 'admin', 10, true, '{admin-roles-explained,admin-activity-log}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.005804+00'),
	('c82e654b-4706-4482-bbaa-eda0f1cd26ad', 'a1111111-1111-4111-8111-111111111105', 'admin-resolve-dispute-money', 'Resolve disputes with money (super admin)', 'Pay the vendor, full refund, or partial refund.', '
**Super admin** only. Finish review and notes, then choose an outcome.

> [!IMPORTANT]
> Money outcomes are final for that dispute. Please confirm amounts and leave notes before you resolve.

- **Pay the vendor.**
- **Full refund to the client.**
- **Partial refund.** Enter the amount in pounds.

Please resolve so the dispute is marked resolved. Support admins should assign a super admin and leave a clear recommendation in notes.
', 'admin', 20, true, '{admin-triage-disputes,admin-roles-explained}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.004629+00'),
	('b51235e2-4643-431d-b77f-82016fb7c761', 'a1111111-1111-4111-8111-111111111107', 'admin-blog-cms', 'Manage blog posts', 'Create, edit, publish, and remove posts.', '
Please open **Blog** in the sidebar. Create or open a post, then edit title, subtitle, web address, author name, cover image, and body.

**Save** as draft, **Publish** when ready, or **unpublish**. **Delete** only when you mean it. Published posts appear on the public blog.
', 'admin', 10, true, '{admin-sign-in-console,admin-activity-log}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.005309+00'),
	('cb7c68ff-d521-4ad0-8242-e257eccc8e99', 'a1111111-1111-4111-8111-111111111103', 'admin-support-hold', 'Pause paying the vendor', 'Hold automatic payment while you investigate.', '
**Super admin.** Use while looking into a dispute or incomplete event before money should move.

> [!WARNING]
> Pausing payment stops automatic payout to the vendor. Please resume only when investigation is complete.

### 1. Open the booking
Please open the booking and **Pause payment** to the vendor.

### 2. Investigate, then resume
Please investigate using Disputes, Messages, and booking chat. **Resume** when it is safe for payment rules to continue.
', 'admin', 30, true, '{admin-booking-support-actions,admin-triage-disputes}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.003909+00'),
	('67f6970b-7a5a-4aff-b100-eb722c9d044d', 'a1111111-1111-4111-8111-111111111108', 'admin-team-manage', 'Invite and manage the admin team', 'Super admin: invite, change roles, suspend admins.', '
Please open **Team**. Any admin can view who is on the team and their role.

**Super admin** only: **Invite** a new admin, change role between support admin and super admin, and **Suspend** or reactivate (not yourself).

The system protects against removing the last super admin. Support admins should ask a super admin for team changes.
', 'admin', 10, true, '{admin-roles-explained,admin-activity-log}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.00547+00'),
	('f2adfe83-29a2-4b21-bf80-9dff30e1811a', 'a1111111-1111-4111-8111-111111111106', 'admin-compose-broadcast', 'Compose and send messages', 'Message selected people or all clients / vendors.', '
Please open **Messages > Compose**.

- **Selected users** (directory search): any support admin.
- **All clients**, **All vendors**, or **All users**: **super admin only**.

### 1. Choose audience
Please pick who receives it.

### 2. Write and send
Please write the message, then send. This creates support conversations.

> [!WARNING]
> Broadcasts are audited. Please double-check audience before sending platform-wide messages.
', 'admin', 20, true, '{admin-support-inbox,admin-suspend-clients}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.005154+00'),
	('85976ef9-1d3f-4d8a-8e53-3608416c38db', 'a1111111-1111-4111-8111-111111111110', 'admin-referral-partners', 'Referral partners and signup links', 'Create partners, copy register links, and see who signed up.', '
Please open **Referrals** in the admin sidebar.

> [!NOTE]
> **Partner signup links** (`?ref=` on vendor register) are separate from **vendor client referral links** (`?vref=` on browse). Partners track who referred a vendor to Eventtz. Client referrals give end clients tier savings on the Eventtz booking fee.

### 1. Create a partner
Please add a partner name (and notes if you use them).

### 2. Share the link
Please copy the **vendor register** link and share it with the partner.

Open a partner to see vendors who registered through that link. Attribution is recorded on first signup from the link. Referrals do not change vendor approval or payout rules. They are for tracking and partner relationships only.
', 'admin', 10, true, '{admin-approve-vendors,admin-dashboard-overview,vendor-client-referrals}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.107744+00'),
	('aef34d27-9854-47cc-8f94-6f7f4de9ae90', 'c1111111-1111-4111-8111-111111111101', 'client-dashboard', 'Your dashboard', 'See what needs your attention: quotes, payments, completion, and reviews.', '
You can open **Dashboard** when you sign in. The top cards show bookings that need action. Tap any card to open the booking.

- A new price to accept or decline.
- Payment ready after the vendor accepted (the date isn''t held until you pay).
- Please confirm the event went well after the date.
- Please leave a review when invited.

Paid bookings for the same celebration can appear together. Upcoming bookings appear on the calendar. We also remind you the day before a paid event.

You can use **Browse** or **Plan my event** when you are still planning.
', 'client', 5, true, '{client-how-booking-works,client-event-planner,client-notifications,client-payments-hub}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.107901+00'),
	('f8030d33-5b35-418d-8633-46ffdcde15d4', 'c1111111-1111-4111-8111-111111111107', 'client-event-planner', 'Plan my event with AI', 'Describe your celebration and get a helpful budget, checklist, and vendor ideas.', '
From your portal, go to **Plan my event**. Describe your celebration and Eventtz builds a plan you can save and come back to.

### 1. Describe your event
Please write in plain English (for example: "Birthday party for 80 people in London in June, need catering and a DJ").

### 2. Review the plan
Please check the budget breakdown, checklist, and vendor suggestions.

### 3. Book from a suggestion
Please tap **Book now** on a suggestion to open **Browse** with useful filters already set.

You can still browse and book without the planner. When you are ready, send booking requests from **Browse** or **Favourites** as usual.
', 'client', 10, true, '{client-browse-vendors,client-how-booking-works,client-dashboard}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:15.997338+00'),
	('d8b4eeaa-9b46-457c-80d8-6328c31e0697', 'c1111111-1111-4111-8111-111111111101', 'client-help-assistant', 'Using Help and Ask', 'Browse articles or ask our Help assistant in the portal.', '
Please tap the **?** button at the bottom of your screen to open Help. Pick a category, then open an article, or use **Ask** to type a question in your own words. The assistant answers from Eventtz help articles.

- **Help** and **Ask:** how-to questions.
- **Contact:** account problems or payment failures.
- **Disputes:** something went wrong with a paid or finished booking.

If Ask cannot answer safely (for example about refunds or bans), it will tell you to use **Contact** or **Disputes**.
', 'client', 15, true, '{client-contact-support,client-how-booking-works,client-report-problem}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:15.997704+00'),
	('58b26bc0-a887-4162-8b26-493723dbe218', 'a1111111-1111-4111-8111-111111111102', 'admin-listing-visibility', 'Publish anyway, hide listing, and automatic', 'Control whether approved vendors appear on Browse.', '
On an approved vendor in **Directory > Vendors**:

- **Automatic.** Default rules apply (approval, payout setup, and profile completeness).
- **Publish anyway.** Show on Browse even when automatic rules would hide them (**super admin** only).
- **Hide listing.** Keep them off Browse even if payouts are ready (**super admin** only).

**Support admin** can set listing back to **Automatic** only.

**Hide listing** only affects Browse visibility. It does not remove payout account details.

If a vendor was paid before but their payout account looks missing in the console, open the vendor **Actions** tab and use **Restore from payout transfer** when shown. This copies the account from their latest payout record. Use this when payout details were cleared by mistake, not for routine listing changes.
', 'admin', 25, true, '{admin-approve-vendors,admin-roles-explained,admin-vendor-submission-review}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.006561+00'),
	('21ea2e86-0ee1-46b3-9671-431f66dbee1b', 'b1111111-1111-4111-8111-111111111101', 'vendor-referral-signup', 'Joining through a partner signup link', 'Register with a partner ?ref= link. This is not the same as a client booking referral.', '
Some **partners** share a special **vendor register** link with `?ref=` in the URL. If you open that link, Eventtz records the partner referral when you create your vendor account.

> [!NOTE]
> This is **not** the same as your **client referral link** (`?vref=`) that gives clients savings on the Eventtz fee when they book you. Partner links are for tracking who referred you to Eventtz as a vendor.

### 1. Open the partner link
Please open the link your partner sent.

### 2. Complete vendor register
Finish **vendor register** as usual, then complete **Profile** and submit when ready.

The partner referral does not change how approval or payouts work. It only helps Eventtz and the partner track signups.
', 'vendor', 30, true, '{vendor-how-to-join,vendor-onboarding-steps,vendor-client-referrals}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.107537+00'),
	('c317a4e2-ccde-47cd-a7e0-8e7751f65301', 'b1111111-1111-4111-8111-111111111101', 'vendor-profile-returned', 'If we ask you to update your profile', 'Your profile may go back to draft with a friendly message explaining what to fix.', '
Our team reviewed your submission and needs a few updates before we can approve you. Don''t worry, this is normal. We return your profile to **draft** so you can edit it again.

You receive an **email** with the list of what to fix and a link to **Profile**, and the same message in **Eventtz Support** (open **Messages** and look for Eventtz Support).

### 1. Open Profile
Please sign in and open **Profile**.

### 2. Fix the items and submit
Update the items we listed (photos, packages, bio, and so on), then submit again when you are ready.

We review resubmissions in the same queue as new applications.
', 'vendor', 25, true, '{vendor-package-quality,vendor-onboarding-steps,vendor-contact-support}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.001201+00'),
	('d0d875ce-e7d0-48d8-830e-f03de33f6d44', 'a1111111-1111-4111-8111-111111111102', 'admin-return-for-edits', 'Return a vendor profile for edits', 'Unlock a submitted profile, email the vendor, and send an Eventtz Support message.', '
You can use this when the vendor submitted but the checklist shows missing or weak items you want them to fix themselves.

Please open **Directory > Vendors**, open the vendor, then **Return for edits**.

### 1. Review the message
The pre-filled message lists missing checklist items automatically. Edit it if needed.

### 2. Return and send
Please click **Return and send message**.

The profile goes back to **draft** so they can edit **Profile**. They receive an **email** with your message and a link, and the same text in **Eventtz Support**. When they fix the issues, they submit again. You review from the same Directory list.
', 'admin', 15, true, '{admin-vendor-submission-review,admin-approve-vendors,admin-support-inbox}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.006176+00'),
	('174e923c-bf9d-46a8-a22c-27cee696f2e0', 'a1111111-1111-4111-8111-111111111102', 'admin-nudge-draft-vendors', 'Email draft vendors to complete profile', 'Select draft vendors and send a reminder email to finish and submit.', '
Please open **Directory > Vendors**. Filter **Profile > draft**.

### 1. Select draft vendors
Please tick the checkboxes (or select all draft on the page).

### 2. Send the reminder
Please click **Send complete profile email**. The toast shows how many emails sent, skipped, or failed.

Only vendors still in **draft** get the email. Submitted or approved vendors are skipped. Failures usually mean no email address on the user account. Check the vendor row before retrying.
', 'admin', 20, true, '{admin-vendor-submission-review,admin-approve-vendors,admin-activity-log}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.006364+00'),
	('b3a1e1a7-9817-419c-9d13-7e5b250493ca', 'c1111111-1111-4111-8111-111111111105', 'client-contact-support', 'Contact Eventtz support', 'Send us a message for account and money questions. We''re happy to help.', '
Please use **Contact** in your portal to message Eventtz. We aim to reply by email within about **two working days**.

Please include your account email, the booking ID for booking or payment issues, and a clear description (screenshots if useful).

- **Help** and **Ask:** how-to questions ("How do I pay?", "How do bookings work?").
- **Contact:** account problems or payment failures we need to investigate.
- **Disputes:** something went wrong with a paid or finished booking.

If Ask cannot answer safely (for example about refunds or bans), it will tell you to use **Contact** or **Disputes**.
', 'client', 20, true, '{client-help-assistant,client-report-problem,client-are-vendors-vetted}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.996579+00'),
	('7cf6dd07-c5ac-44bc-8df2-e5f9b890f928', 'a1111111-1111-4111-8111-111111111104', 'admin-marketplace-analytics', 'Marketplace analytics', 'Funnel metrics plus enquiry reminder and client nudge counts.', '
Please open **Commerce > Marketplace**.

Please look at steps from request to accept to pay to complete, conversion rates, how fast vendors reply to new enquiries, enquiry reminder counts, client nudges when vendors don''t reply within 24 hours, ratings and profile views, why bookings fail when that is shown, breakdowns by category and place, and top vendors when shown.

You can use this to spot slow replies and drop-offs after accept.
', 'admin', 20, true, '{admin-read-financials,admin-find-bookings,admin-dashboard-overview}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.004255+00');
INSERT INTO public.help_articles VALUES
	('c0122759-66d3-4d08-a6a9-c773013df311', 'b1111111-1111-4111-8111-111111111106', 'vendor-growth-score-explained', 'Understanding your Growth Score', 'What each part means and how to improve it.', '
Your Growth Score is made of five areas.

- **Listing quality.** Clients need a clear photo, bio, bookable packages, and portfolio photos. Complete at least one package with name, price, and what''s included.
- **Response speed.** Reply to new enquiries within **2 hours** when you can. Slow replies lower your score and clients may book someone else.
- **Booking conversion.** This measures enquiries that become completed bookings. Accept suitable jobs promptly and keep packages accurate.
- **Reviews.** After a great event, happy clients can leave a review. Strong reviews help you stand out on Browse.
- **Availability.** Set which weekdays you take bookings and your daily limit. Block dates when you are fully booked.
', 'vendor', 36, true, '{vendor-growth-copilot,vendor-analytics}', '2026-09-26 02:13:15.679243+00', '2026-09-26 02:13:16.001932+00'),
	('561d4f90-f629-4e3b-b565-284f7dd2e45d', 'a1111111-1111-4111-8111-111111111101', 'admin-sign-in-console', 'Sign in and use the admin console', 'Open the console, move around, and sign out.', '
Please sign in at **Login**, then go to the admin dashboard. Legacy admin login links still work and take you to the same place.

### 1. Sign in
Please open the Eventtz login page, then sign in with an account whose user type is **admin**. You land on the dashboard.

The sidebar (desktop) or menu (mobile) includes Dashboard, Commerce, Directory, Referrals, Messages, Report a bug, Blog, Trust and safety, Settings, Team, and Activity log. **Email health** appears only for **super admins**. Your role label shows as **Support admin** or **Super admin**.

Please use **Sign out** in the shell. You return to the login page.

Use the **?** help button (bottom right) for walkthrough articles and the admin assistant. For product bugs, use **Report a bug**.
', 'admin', 10, true, '{admin-roles-explained,admin-dashboard-overview,admin-report-bug}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.002681+00'),
	('93d63313-302c-4659-b46a-f166f98c95b1', 'b1111111-1111-4111-8111-111111111101', 'vendor-onboarding-steps', 'Vendor profile steps', 'Eight friendly steps from Account through Review, then submit.', '
Please open **Profile** and work through each step. Progress saves as you go.

> [!NOTE]
> Packages need clear **What''s included** text. Clients book from packages, not vague chat promises.

1. **Account.** Contact details and profile photo.
2. **Business.** Business name, services, and bio basics.
3. **Location.** Where you work and travel rules.
4. **Pricing.** Packages with clear **What''s included** text. See **Pricing, packages, and AI help**.
5. **Availability.** When you can take bookings.
6. **Portfolio.** Photos (and video if you offer it).
7. **Additional info.** Optional certificates or disclosures.
8. **Review.** Check everything, then **Submit for review**.

Some fields may stay read-only until we finish review. If we need changes, we return your profile to draft and email you.

After approval, edit your live listing from **Profile**. Keep packages, photos, and availability up to date.
', 'vendor', 20, true, '{vendor-package-quality,vendor-how-to-join,vendor-when-live,vendor-pending-access}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.998467+00'),
	('7b646d41-2357-40a9-9f7e-8ba8b1df6daa', 'c1111111-1111-4111-8111-111111111101', 'client-browse-vendors', 'How to browse and find vendors', 'Search by what you need, where, and when. We''re here to help you find the right fit.', '
Use **Browse** to find vendors by service, location, and date. Each listing shows packages, photos, reviews, and prices where the vendor has listed them.

> [!NOTE]
> If a vendor sent you a referral link, open it before you book. The `?vref=` part saves their code so you can get tier savings on the Eventtz fee when the booking qualifies (£10 at £400+, £15 at £600+).

### 1. Search and filter
Use filters for service type, area, and availability. Open a profile to read more.

### 2. Save favourites
Tap the heart to save vendors you like. Find them again under **Favourites**.

### 3. Send a request or message
Pick packages and send a booking request, or message the vendor first if you need a custom quote.
', 'client', 10, true, '{client-favourites,client-how-booking-works,client-service-fee,client-event-planner}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.10735+00'),
	('c30b7e0f-4d53-4ef7-b516-1a6c8217dd27', 'b1111111-1111-4111-8111-111111111104', 'vendor-payment-documents', 'Payment record and payout statement', 'View what the client paid and your payout document after release.', '
Please open **Payments** to set up how you get paid, then view documents for each booking after money has moved.

- **Payout account.** Set up or check how you get paid.
- **Payout history.** Bookings where money has moved.

After the client pays, you can open a **Payment record** (what they paid, including the Eventtz fee on their side). After your payout is released, you can open a **Payout statement** for that booking. View on screen, then download or print if you need a copy.

The payment record appears after the client pays. The payout statement appears after payout is released. If something looks stuck, finish payout setup or use **Contact** with the booking ID.
', 'vendor', 30, true, '{vendor-when-get-paid,vendor-stripe-payouts,vendor-no-cut}', '2026-09-26 02:13:15.910654+00', '2026-09-26 02:13:16.002502+00'),
	('d2939562-60d5-4807-b741-6943c5516856', 'b1111111-1111-4111-8111-111111111102', 'vendor-pending-access', 'What you can do while waiting for approval', 'You can edit Profile, read Messages, and Contact us while pending. Bookings unlock after approval.', '
While your profile is pending you can usually open **Profile** and finish or fix your application, open **Messages** to read **Eventtz Support**, use **Contact** to reach Eventtz, and read **Help**.

These areas stay unavailable until we approve you:

- **Bookings** (accepting client requests)
- **Analytics**
- **Payments** setup for live bookings
- Most other vendor tools that assume you are live

Once approved, you can open **Bookings**, **Payments**, and **Analytics**. You still need payout setup finished before you can **accept** a paid booking.
', 'vendor', 5, true, '{vendor-when-live,vendor-stripe-payouts,vendor-onboarding-steps}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.001382+00'),
	('2c5af625-4c0c-4c4d-a04f-c37dd9d0517e', 'a1111111-1111-4111-8111-111111111101', 'admin-report-bug', 'Report a bug', 'Send a staff bug report from the console.', '
Please use **Report a bug** in the sidebar when something in the console is broken. You can also use it when Help cannot answer.

Please include what you expected, what happened, a booking ID, vendor, or client if it is about a live case, and screenshots if they help.

This always files as a bug report. It does not classify the subject with AI.

Please open **Settings** to change your admin password. Test accounts on that page are for internal QA only. Please don''t share those passwords in Help or Messages.
', 'admin', 40, true, '{admin-sign-in-console,admin-roles-explained,admin-activity-log}', '2026-09-26 02:13:15.910654+00', '2026-09-26 02:13:16.006926+00'),
	('55d2ec94-1176-4f44-969f-0508b1b5cbd2', 'c1111111-1111-4111-8111-111111111103', 'client-payment-receipts', 'Payment history and receipts', 'See your past payments and open a payment receipt.', '
Download a receipt for a paid booking, or browse everything you have paid from **Payment history**.

## Payment history

Open **Payment history** from your menu. You will see bookings that have been paid, refunded, or paid out.

## Payment receipt

On a paid booking, open **Payment receipt**. You can view it on screen and download or print the page.

The receipt shows the event, vendor portion, Eventtz fee (including any referral discount line), and payment status.

## If a receipt is missing

Receipts appear after payment succeeds. If you paid and still cannot see one, use **Contact** and include the booking ID.
', 'client', 40, true, '{client-payments-hub,client-when-do-i-pay,client-payment-safe,client-service-fee}', '2026-09-26 02:13:15.910654+00', '2026-09-26 02:13:16.107143+00'),
	('4096fa88-283c-4791-a186-4a2e1177c19c', 'b1111111-1111-4111-8111-111111111103', 'vendor-accept-booking', 'Accepting or declining requests', 'Please respond from Bookings once getting paid is set up. We''ll remind you if a request is waiting.', '
Please respond from **Bookings**. Faster replies win more bookings. We remind you if a request is still waiting, usually after about **1 hour**, **6 hours**, and **24 hours**.

> [!NOTE]
> The date isn''t confirmed for the client until they pay. Accept quickly, then watch for their payment.

### 1. Open the request
Please open **Bookings**, then the pending request. Read the date, place, packages, and notes. Chat if you need clarity.

### 2. Accept or decline
**Accept** or **Decline**. If how you get paid isn''t ready, Eventtz will ask you to finish bank setup first. After you return from the payments partner, open the booking again to accept.

After you accept, the client can pay. The date isn''t confirmed for them until they pay. Watch **Messages** and **Notifications**.
', 'vendor', 10, true, '{vendor-stripe-payouts,vendor-price-update,vendor-messages-clients}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.999023+00'),
	('6f52c9ed-4d63-4fed-af12-6b1e779b431c', 'c1111111-1111-4111-8111-111111111103', 'client-when-do-i-pay', 'When do I pay?', 'Pay after the vendor accepts. Your date isn''t held until payment goes through.', '
You pay **after the vendor accepts**. Checkout shows the full total before you confirm payment.

> [!NOTE]
> The total includes the vendor portion, the **5% Eventtz fee** on that vendor total, and any **referral savings** if you used the vendor''s code.

### 1. Wait for acceptance
The vendor reviews your request and accepts or declines. The date is not held until you pay.

### 2. Review the breakdown
Open the booking and start checkout. You see:

- Vendor portion (packages and agreed changes)
- Eventtz fee (5% of the vendor total, minus referral savings if applicable)
- **Total due**

### 3. Pay securely
Pay on the secure payment page. We hold the money until the event is done.

If you have not paid about **24 hours** after they accept, we remind you to pay to confirm the date.

> [!WARNING]
> If you wait too long, another client could book the same date with that vendor.

After you pay, open a **Payment receipt** from the booking or **Payment history**.

If payment fails, try again from the same booking or use **Contact** and include the booking ID.
', 'client', 10, true, '{client-service-fee,client-payment-safe,client-payment-receipts,client-how-booking-works}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.10672+00'),
	('9ccbce7b-733b-434b-92af-d7ac0a310c54', 'b1111111-1111-4111-8111-111111111106', 'vendor-growth-copilot', 'Your Growth Co-pilot', 'Daily tips, Growth Score, and AI help to win more bookings.', '
The **Growth Co-pilot** is your personal helper inside the vendor portal. It reads your real numbers (profile views, enquiries, response time) and suggests what to do next.

You can open it from the **sparkle button** on any vendor page, or read **Today''s focus** on your dashboard.

Your **Growth Score** (0 to 100) tracks listing quality, response speed, booking conversion, client reviews, and availability. Improve the areas marked **needs work** first.

> [!NOTE]
> The co-pilot never changes your profile automatically. You always review and save.

On **Profile > Pricing**, tap **Help me improve my packages** for clearer package names and descriptions. On a pending booking, use **Draft accept message** to get a starting reply. Edit it before you send.

For refunds, disputes, payout problems, or account suspension, use **Contact**. The co-pilot will point you there for money questions.
', 'vendor', 35, true, '{vendor-growth-copilot,vendor-analytics,vendor-client-referrals,vendor-notifications}', '2026-09-26 02:13:15.679243+00', '2026-09-26 02:13:16.108032+00'),
	('7a422ae0-0bbd-4dc4-95c0-3bc3187fc72d', 'a1111111-1111-4111-8111-111111111102', 'admin-deleted-accounts', 'When a user deletes their account', 'Listings hide, personal details are removed, booking history stays.', '
Clients and vendors can close their own account from **Settings** with their password. Admins can''t delete their own admin login this way.

> [!NOTE]
> Please don''t try to remove the user record. The account stays as a deleted placeholder on purpose so the other party keeps their booking history.

You will see **Deleted user** on bookings, chats, and reviews; vendor listings hidden from Browse; email, phone, and other personal details stripped; and shared bookings, chats, reviews, and disputes still in place.

They can''t delete while money is still moving, an accepted event is still ahead, or a dispute is open. If a payout is held because payout setup was incomplete, that still needs a payout or support action. See **Booking support actions**.
', 'admin', 30, true, '{admin-suspend-clients,admin-booking-support-actions,admin-activity-log}', '2026-09-26 02:13:15.910654+00', '2026-09-26 02:13:16.007093+00'),
	('7d888607-9635-4ba2-a3c4-2c29d296d373', 'c1111111-1111-4111-8111-111111111106', 'client-delete-account', 'Delete your account', 'You can permanently close your Eventtz account from Settings.', '
You can close your Eventtz account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details.

> [!IMPORTANT]
> Deleting your account is permanent. Please finish or cancel open bookings before you continue.

> [!WARNING]
> This can''t be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. The other person on a booking still sees the date, venue, and amounts.

## Before you start

You will need your current password.

You''ll need to wait before deleting if:

- **Payment in progress.** Finish payout or wait for a refund.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

## Delete your account

### 1. Open Settings
From the client area, select **Settings**, then **Account**.

### 2. Confirm and delete
Please tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account. The other person still has the booking contract, and your name shows as a deleted user.
', 'client', 30, true, '{client-account-settings,client-password-reset,client-contact-support}', '2026-09-26 02:13:15.910654+00', '2026-09-26 02:13:15.997881+00'),
	('7690880a-9c17-460e-8590-0d141932020a', 'b1111111-1111-4111-8111-111111111101', 'vendor-package-quality', 'Pricing, packages, and AI help', 'Build clear packages and use AI tools on Pricing and Review.', '
Each **package** is one bookable service with a name, price, and **What''s included** text. Clients need enough detail to know what they are booking.

A good package has a clear name (for example "Full day wedding photography"), a price, **What''s included** with real detail (hours, deliverables, travel rules), and a profile photo on your account before you submit. Some categories (such as catering or baking) need at least one complete package before you can submit.

On **Pricing**, open **Help me improve my packages**. Eventtz reviews your packages and can suggest clearer names and descriptions. Review the changes, then save.

> [!NOTE]
> AI can make mistakes. Please always check prices and details before you submit.

On **Review**, you can **Generate bio with AI** or write your own. Keep it honest and under the word limit shown on screen. If we return your profile for edits, fix the items in the email and Eventtz Support message, then submit again from **Profile**.
', 'vendor', 15, true, '{vendor-onboarding-steps,vendor-profile-returned,vendor-edit-profile}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.001022+00'),
	('8b8da6a6-8647-498c-9226-32d83591959a', 'a1111111-1111-4111-8111-111111111102', 'admin-vendor-submission-review', 'Review a submitted vendor profile', 'Open a vendor, read the checklist, then approve, return for edits, or ban.', '
Please open **Directory > Vendors**. Filter **Profile > submitted** and **Approval > pending** when triaging new applications.

Please open a vendor to see their full application and a **checklist** of required items (photos, packages, bio, policies, and similar).

- **Approve** when the profile is ready.
- **Return for edits** when they can fix issues and resubmit.
- Leave **pending** while you are still reviewing.

See **Return for edits**, **Publish anyway / Hide listing**, and **Email draft vendors** for the next step.
', 'admin', 5, true, '{admin-approve-vendors,admin-return-for-edits,admin-nudge-draft-vendors}', '2026-09-26 02:13:15.657089+00', '2026-09-26 02:13:16.005991+00'),
	('92651381-1380-4de8-8870-503a5396e64a', 'c1111111-1111-4111-8111-111111111102', 'client-how-booking-works', 'How does booking work?', 'Ask, agree on a price, pay when they say yes, then confirm after your event.', '
Everything stays in one place from first browse to payment. You do not pay until the vendor accepts, and the date is not held until you pay.

> [!NOTE]
> You can message several vendors at once, but only **pay** the booking you want to keep.

### 1. Browse and choose
Open **Browse** (or **Plan my event** for AI ideas). Check packages, reviews, and prices. Save favourites with the heart icon.

If a vendor shared a referral link (`?vref=`), open it before you book so your code is saved. You can also enter their code on the booking form.

### 2. Send a request
Pick a package or service, add your date and venue if you have them, and send a booking request. Track it under **Bookings**.

### 3. Agree the details
Use **Messages** to agree scope and price. The vendor may send an updated price. Accept or decline from the booking page.

### 4. Pay after they accept
When the vendor accepts, pay from the booking page. You see the full total, including the Eventtz fee and any referral savings, before you confirm.

### 5. After the event
Confirm completion if it went well so the vendor can be paid. If something went wrong, open **Disputes** instead.
', 'client', 10, true, '{client-when-do-i-pay,client-service-fee,client-multi-enquire,client-event-planner}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.106942+00'),
	('b8e07449-bb0a-468e-900b-5c96aa325699', 'c1111111-1111-4111-8111-111111111105', 'client-report-problem', 'What if something goes wrong?', 'If something went wrong, please report it from your booking. We may pause paying the vendor while we help.', '
If something serious went wrong (no-show, major quality issue, safety concern), don''t worry. Please report it from the booking so we can pause paying the vendor and review.

> [!IMPORTANT]
> Please open a **dispute** instead of confirming the event went well. Confirming tells us the booking finished successfully.

### 1. Open the booking
Please open it under **Bookings**, or go to **Disputes** in the menu.

### 2. Report the problem
Please choose to report a problem / open a dispute. Explain what happened and add photos if you can.

We review the case and may **pause paying the vendor** until it is sorted. Check the dispute for updates.

Disputes aren''t for simple how-to questions (use Help or **Contact**) or changing your mind before the event when cancel still works.
', 'client', 10, true, '{client-contact-support,client-payment-safe,client-cancel-refund}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.996331+00'),
	('76ac6319-520a-4044-9464-ac8071e0ec70', 'b1111111-1111-4111-8111-111111111102', 'vendor-when-live', 'When will my profile go live?', 'Approval, Browse visibility, and payout setup are separate steps. Don''t worry, we''ll guide you.', '
Going live is three separate things. Don''t worry, we''ll walk you through each one.

> [!NOTE]
> Approval and **Browse** visibility don''t mean payout setup is done. Finish **Payments** before you accept a paid booking.

### 1. Submit and get approved
Please finish **Profile** and **Submit for review**. Our team approves when the listing meets our standards.

### 2. Browse visibility
After approval, clients can usually find you on **Browse** when automatic listing rules pass. Admins can also hide or force-publish a listing.

### 3. Payout setup before accepting bookings
Setting up how you get paid is **not** required to be approved. You **do** need it finished before you can **accept** a booking that will be paid through Eventtz.

**Profile**, **Dashboard**, and **Payments** show approval status, listing reminders, and payout setup.
', 'vendor', 10, true, '{vendor-stripe-payouts,vendor-pending-access,vendor-onboarding-steps}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.998652+00'),
	('5c81b0e3-d219-4c0d-9c64-7e7727a788ad', 'b1111111-1111-4111-8111-111111111102', 'vendor-stripe-payouts', 'Set up how you get paid', 'Please finish how you get paid before you accept. We''ll nudge you if setup is still open.', '
You''ll need to finish payout setup before you can accept a client booking. That way money can move safely after the event. That way money can move safely after the event.

> [!WARNING]
> If payout setup isn''t finished when a booking is ready to pay out, we **hold** the money until you complete it.

Please open **Payments**, or follow the prompt when you try to **accept** a booking.

### 1. Start payout setup
Please start from **Payout account**.

### 2. Complete identity and bank details
Please finish the steps with our payments partner, then return to Eventtz and wait until setup shows as ready.

If payout setup is still open about **24 hours** after we approve you, we email a reminder to finish it.

When everyone confirms (or about **48 hours** after the event with no problem), money goes to your bank on the payments partner''s schedule. If both sides confirmed but payout setup isn''t ready, we **hold** the payout until you finish it.
', 'vendor', 20, true, '{vendor-when-get-paid,vendor-accept-booking,vendor-payment-documents}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:15.998836+00'),
	('3c645012-9487-4465-9e47-866270cec3d2', 'b1111111-1111-4111-8111-111111111104', 'vendor-when-get-paid', 'When do I get paid?', 'After both sides confirm, or about 48 hours later. Held if payout setup isn''t finished yet.', '
The client pays after you accept. Eventtz holds the money. After the event, you and/or the client confirm it went well. If there is no problem, money can also release about **48 hours** after the event. Then money goes to your bank on the payments partner''s schedule.

> [!NOTE]
> If both of you confirmed but **Payments** isn''t ready, we hold the payout until you finish setup.

When **both** of you confirm, payout can start sooner. We also send an **event tomorrow** reminder the day before a paid booking.

## If payout is held

If you and the client both confirmed but how you get paid isn''t ready, we hold the payout and notify you. Open **Payments** and finish payout setup so we can send the funds.

Other delays include an open dispute, paused payment, or bank checks still in progress. Check **Payments** and the booking. Use **Contact** with the booking ID if money is late after it should have been released.
', 'vendor', 20, true, '{vendor-no-cut,vendor-stripe-payouts,vendor-payment-documents,vendor-complete-cancel}', '2026-09-26 02:13:15.308301+00', '2026-09-26 02:13:16.000053+00'),
	('638e472b-9b5f-4d20-be22-ac2c9dbe4fae', 'b1111111-1111-4111-8111-111111111107', 'vendor-delete-account', 'Delete your account', 'You can permanently close your vendor account from Settings.', '
You can close your vendor account from **Settings > Account > Delete account**. We remove your profile, login, messages, and saved details, and your listing leaves Browse.

> [!IMPORTANT]
> Deleting your account is permanent. Finish open bookings and payouts before you continue.

> [!WARNING]
> This can''t be undone. Booking and payment records we must keep for tax stay on file without your name, email, or phone. Clients still see the date, venue, and amounts.

## Before you start

You will need your current password.

You''ll need to wait before deleting if:

- **Payment or payout in progress.** Finish it first.
- **An accepted booking is still ahead.** Complete or cancel it first.
- **An open problem report.** Wait until it is resolved.

Closing the account also closes payout setup with our payments partner. A new registration starts payout setup again.

### 1. Open Settings
From the vendor area, select **Settings**, then **Account**.

### 2. Confirm and delete
Please tap **Delete account**, enter your password, and confirm.

You are signed out. You can register again later with the same email. It will be a new account.
', 'vendor', 20, true, '{vendor-account-settings,vendor-stripe-payouts,vendor-contact-support}', '2026-09-26 02:13:15.910654+00', '2026-09-26 02:13:16.002309+00'),
	('7955f9b2-9402-4de1-ae02-42bd4b453c69', 'a1111111-1111-4111-8111-111111111101', 'admin-roles-explained', 'Support admin vs super admin', 'What each role can see and change.', '
Support admins handle day-to-day review. Super admins can also move money, change team roles, and override listing visibility.

## Support admin

Can:

- View dashboard, commerce lists, financials summary, marketplace analytics
- Approve, pending, or ban vendors; set listing back to **Automatic**; suspend or unsuspend clients
- Triage disputes (status, assign, party notes); hide or unhide reviews
- Please send support messages to **selected users**; use Blog CMS
- Read Team roster and Activity log

Can''t:

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
', 'admin', 20, true, '{admin-sign-in-console,admin-booking-support-actions,admin-report-bug,admin-listing-visibility}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.002867+00'),
	('0dbc758c-853e-4e84-b450-e925d6eb9a4d', 'a1111111-1111-4111-8111-111111111103', 'admin-booking-support-actions', 'Booking support actions (super admin)', 'Check payment, pay vendor, complete, cancel. Payout may stay held until payout setup is ready.', '
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
', 'admin', 20, true, '{admin-support-hold,admin-roles-explained,admin-find-bookings,admin-deleted-accounts}', '2026-09-26 02:13:15.351996+00', '2026-09-26 02:13:16.003737+00'),
	('cf7b74ea-36eb-4cff-a289-e714633fa09b', 'c1111111-1111-4111-8111-111111111103', 'client-payments-hub', 'Payment history', 'See everything you have paid, refunded, or paid out in one place.', '
Open **Payment history** from the client menu to see bookings where money has moved: paid, refunded, or paid out to the vendor.

> [!NOTE]
> You can also open a **Payment receipt** from an individual booking after you pay.

Each row shows the event, date, status, and amount. Tap a booking to open full details, messages, and receipts.

If you paid but a booking is missing from the list, use **Contact** and include the booking ID.
', 'client', 35, true, '{client-payment-receipts,client-when-do-i-pay,client-service-fee,client-payment-safe}', '2026-09-26 02:13:16.105199+00', '2026-09-26 02:13:16.105199+00'),
	('78d22682-0e46-4291-ab66-72647e5c1934', 'c1111111-1111-4111-8111-111111111106', 'client-notifications', 'Notifications', 'See booking updates, messages, and reminders in one place.', '
Open **Notifications** from the client menu. You will see booking updates, payment reminders, message alerts, and other activity.

Unread items are highlighted. Tap a notification to open the related booking, chat, or page.

You can control email alerts in **Settings > Notifications**.
', 'client', 25, true, '{client-dashboard,client-how-booking-works,client-account-settings}', '2026-09-26 02:13:16.105199+00', '2026-09-26 02:13:16.105199+00'),
	('f656b8ec-1393-48e9-98ee-54bfa06b6f19', 'b1111111-1111-4111-8111-111111111107', 'vendor-notifications', 'Notifications', 'See new requests, messages, and payout updates.', '
Open **Notifications** from the vendor menu. You will see new booking requests, client messages, payment and payout updates, and reminders.

Unread items are highlighted. Tap a notification to open the booking, chat, or related page.

You can control email alerts in **Settings > Notifications**.
', 'vendor', 15, true, '{vendor-accept-booking,vendor-messages-clients,vendor-account-settings}', '2026-09-26 02:13:16.105199+00', '2026-09-26 02:13:16.105199+00'),
	('41416e03-45b8-4fa5-88ae-2543f974ef5f', 'c1111111-1111-4111-8111-111111111106', 'client-verify-email', 'Confirm your email', 'Verify your address so you can sign in and receive booking updates.', '
After you register, we may ask you to **confirm your email**. Please open the link in the email we send, then sign in again.

> [!NOTE]
> Check spam if you do not see the message within a few minutes. You can request a new link from the sign-in page.

Verified email helps with password reset and payment receipts.
', 'client', 15, true, '{client-create-account,client-password-reset,client-account-settings}', '2026-09-26 02:13:16.105199+00', '2026-09-26 02:13:16.105199+00'),
	('9bdc15c3-49e7-4b7d-bf22-cb5072e468aa', 'b1111111-1111-4111-8111-111111111106', 'vendor-reviews-inbox', 'Reviews on your profile', 'See client reviews and your average rating.', '
Clients can leave a review after a completed booking. Open **Profile > Reviews** (or **Reviews** from your menu) to read them.

Your average rating and review count appear on your public listing and help clients choose you.

> [!NOTE]
> You cannot edit a client''s review. If you believe one breaks our rules, use **Contact** with the booking ID.

Reply professionally in **Messages** if you want to follow up with the client.
', 'vendor', 35, true, '{vendor-analytics,vendor-edit-profile,client-leave-review}', '2026-09-26 02:13:16.105199+00', '2026-09-26 02:13:16.105199+00'),
	('4d95f285-1a10-4647-b22c-a64e4a5dc7b0', 'b1111111-1111-4111-8111-111111111104', 'vendor-client-referrals', 'Share a referral link with clients', 'Share a link or up to 6-digit code so clients save on the Eventtz fee.', '
Every approved vendor can create a **client referral code** and share link in **Settings > Referrals**. When a client books with your link or code, they can save on the **Eventtz booking fee**. Your quote and payout stay the same.

> [!NOTE]
> This is different from a **partner signup link** (`?ref=` on vendor register). Client referrals use `?vref=` on your listing and lower the client''s Eventtz fee only.

## Tier savings (off the Eventtz fee)

| Vendor total on the booking | Client saves |
|-----------------------------|--------------|
| £400+ | £10 |
| £600+ | £15 |

The best qualifying tier applies (not cumulative). If the total drops below a tier before checkout, the discount updates automatically.

## Your referral code

Your code is **1 to 6 digits** (for example `482910`). Choose your own in Settings or tap **Generate** for a random code.

### 1. Open Referrals in Settings
Please open **Settings**, then select the **Referrals** tab.

### 2. Copy your link or code
Copy the share link or the code itself. Send it by email, social, or your website.

### 3. How clients use it
Clients can open your listing with `?vref=your-code` in the link, or enter the code when they send a booking request.

## Tracking

The same tab lists bookings that used your code: event name, date, status, vendor total, and how much the client saved on the Eventtz fee.

## What you keep

Eventtz charges clients a **5% fee** on the full vendor total (packages plus any surcharges or discounts you add). Referral savings come off that fee only. You still receive your agreed vendor amount.
', 'vendor', 15, true, '{vendor-no-cut,vendor-account-settings,vendor-when-get-paid,vendor-referral-signup}', '2026-09-26 02:13:16.105199+00', '2026-09-26 02:13:16.145865+00'),
	('dbb9bf0c-e9af-465e-9972-c8684bd38fef', 'b1111111-1111-4111-8111-111111111101', 'vendor-dashboard', 'Your dashboard', 'See new requests, bookings calendar, and what needs attention.', '
Open **Dashboard** when you sign in. It is your home for what needs action today.

## What you will see

- **Attention** cards for new booking requests, unread messages, and payout setup if it is not finished.
- **Bookings calendar** and upcoming events.
- **Growth Co-pilot** tips when available.

Please respond to new requests from **Bookings** or the attention cards. Faster replies win more bookings.

If payout setup is not ready, finish it from **Payments** before you accept paid bookings.

To share a client referral link, open **Settings > Referrals**.
', 'vendor', 5, true, '{vendor-accept-booking,vendor-client-referrals,vendor-growth-copilot,vendor-notifications}', '2026-09-26 02:13:16.105199+00', '2026-09-26 02:13:16.146731+00'),
	('cf3f7985-438f-4109-b2f6-020c0e926cfb', 'b1111111-1111-4111-8111-111111111107', 'vendor-account-settings', 'Account settings', 'Password, sharing, referrals, notifications, and more under Settings.', '
Your **Settings** control login, privacy, client referrals, notifications, and account deletion. These are separate from your public **Profile**.

> [!NOTE]
> Use **Profile** to edit your public listing. Use **Settings** for login, privacy, referrals, and closing the account.

## Open Settings

From the vendor area, select **Settings**.

## What you can manage

- **Account.** Email, password, and **Delete account**.
- **Privacy.** Contact sharing and notification preferences.
- **Referrals.** Your client referral code, share link, and bookings that used it.
- **More.** Keyboard shortcuts and legal links.

Keep notification email on so you do not miss new requests, event reminders, or payout messages.
', 'vendor', 10, true, '{vendor-delete-account,vendor-edit-profile,vendor-client-referrals,vendor-contact-support}', '2026-09-26 02:13:15.910654+00', '2026-09-26 02:13:16.147079+00');
