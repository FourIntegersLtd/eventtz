"""Help Centre articles that describe cancellation, payment and payouts, matched to the 2026-11-01 Terms

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-17

The articles seeded in 0002 described the old rules: a full refund on any client cancel, and payout
48 hours after every event. The Terms that take effect on 2026-11-01 (and the code in 0006/0007)
add cancellation policies, a payment deadline, longer reporting windows for equipment hire and
decorations, two-part payouts for photos and video, and refundable deposits. This revision rewrites
the nine affected articles in the same plain English as the Terms. Downgrade restores the 0002 text.

The numbers here are copied from web/lib/policyConstants.json; change both together.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The text this revision writes.
NEW_ARTICLES: dict[str, dict[str, str]] = {
    "client-accept-quote": {
        "body_md": "\n"
        "While you are still deciding, a vendor may send a custom quote from "
        "chat, or a price update for extras or a discount.\n"
        "\n"
        "> [!NOTE]\n"
        "> Please read the new total carefully. You only pay after you "
        "**accept** the price and the vendor has accepted the booking.\n"
        "\n"
        "### 1. Open the booking\n"
        "Please open the booking under **Bookings** and read the new total "
        "carefully.\n"
        "\n"
        "### 2. Accept or decline\n"
        "**Accept** if you agree, or **Decline** if you do not.\n"
        "\n"
        "You only pay after you and the vendor agree the price, and they have "
        "accepted the booking. If you decline, keep chatting or cancel that "
        "request if you are done with that vendor.\n"
        "\n"
        "### 3. Pay before the deadline\n"
        "After the vendor accepts, you have **72 hours** to pay. You must also "
        "pay at least **48 hours** before the event, so the time is shorter if "
        "the event is soon. The booking shows the exact time to pay by.\n"
        "\n"
        "If you do not pay in time, the booking is cancelled, you are not "
        "charged, and the vendor's date becomes free for other clients.\n",
        "summary": "Please respond when a vendor sends a new quote or price change. Once "
        "the vendor accepts, you have a set time to pay.",
    },
    "client-cancel-refund": {
        "body_md": "\n"
        "Please open the booking and use **Cancel** when it is allowed.\n"
        "\n"
        "## If you have not paid yet\n"
        "You can cancel at any time. You are not charged anything.\n"
        "\n"
        "## If you already paid\n"
        "- You always get the Eventtz **service fee** back in full.\n"
        "- How much of the vendor's price you get back depends on the vendor's "
        "**cancellation policy** (Flexible, Moderate or Strict) and how many "
        "days before the event you cancel. Whatever you do not get back is paid "
        "to the vendor.\n"
        "- You can see the policy on the vendor's profile and again before you "
        "pay. The policy shown when you paid is the one that applies.\n"
        "- The full table is in our **Terms of Service**, section 4.\n"
        "\n"
        "## Changed your mind straight away?\n"
        "You get all your money back if you cancel within **24 hours** of "
        "paying and the event is at least **7 days** away.\n"
        "\n"
        "## When you always get everything back\n"
        "- The vendor cancels, or Eventtz cancels.\n"
        "- The vendor does not turn up, or does not provide the service, and we "
        "agree after you report it.\n"
        "- A very serious reason we agree with, such as a death or serious "
        "illness, a serious injury, or government rules that stop the event.\n"
        "\n"
        "## Changing the date (rescheduling)\n"
        "Want to reschedule? You don't need to cancel to move your event. On the booking, ask for "
        "new dates. The vendor can say yes or no. If they say yes, only the "
        "dates change: the price, what you paid and the cancellation policy "
        "stay the same. You can take back your request until they answer.\n"
        "\n"
        "Banks often take **5 to 10 working days** to show a refund.\n"
        "\n"
        "> [!NOTE]\n"
        "> Please don't use cancel for a problem after the event. Report a "
        "problem from the booking so we can pause paying the vendor and help.\n",
        "summary": "How much you get back depends on the vendor's cancellation policy and "
        "how soon the event is. You always get the service fee back. To change the date, "
        "you don't need to cancel.",
    },
    "client-complete-booking": {
        "body_md": "\n"
        "For a paid booking, we send an **event tomorrow** reminder the day "
        "before so you have time, venue, and messages in one place.\n"
        "\n"
        "### 1. Open the booking\n"
        "After the event, please open the booking under **Bookings**.\n"
        "\n"
        "### 2. Confirm it went well\n"
        "Please confirm it is complete when asked. The vendor should confirm "
        "on their side too. When **both** of you confirm, the vendor can be "
        "paid sooner.\n"
        "\n"
        "If nobody reports a problem, the vendor is paid when the **time to "
        "report a problem** ends. This is usually **48 hours** after the "
        "event, and **96 hours** for equipment hire and decorations. The "
        "booking shows the exact time.\n"
        "\n"
        "### Photos and video\n"
        "Some photographers and videographers are paid in two parts: one "
        "part after the event, and the rest when you get your photos or "
        "video. When they arrive, press **Confirm I've received my "
        "photos/video** on the booking. If they have not arrived by the date "
        "shown, report a problem.\n"
        "\n"
        "### Refundable deposits\n"
        "Some equipment hire and decoration vendors ask for a refundable "
        "deposit. It is returned to you automatically unless the vendor "
        "reports damage or missing items in time. If they do, our team "
        "decides how much they get, and the rest comes back to you.\n"
        "\n"
        "> [!WARNING]\n"
        "> If something went wrong, please don't confirm. Report a problem "
        "from the booking so we can hold the money and review.\n"
        "\n"
        "After a successful booking you may be asked to leave a review.\n",
        "summary": "Confirm after your event so the vendor can be paid. You have a set "
        "time to report a problem first.",
    },
    "client-payment-safe": {
        "body_md": "\n"
        "When you pay, Eventtz holds the money safely for you. The vendor is not "
        "paid the moment you pay. You pay on a secure payment page. Eventtz "
        "doesn't keep your full card number.\n"
        "\n"
        "> [!NOTE]\n"
        "> Your money stays protected until the event is done and any problems "
        "are sorted out.\n"
        "\n"
        "Money is released to the vendor when you and the vendor both say the "
        "event went well, or when the time to report a problem ends. This is "
        "usually **48 hours** after the event, and **96 hours** for equipment "
        "hire and decorations.\n"
        "\n"
        "For some photographers and videographers, part of the money is paid "
        "after the event and the rest when you confirm your photos or video "
        "arrived.\n"
        "\n"
        "If there is a problem, report it from the booking. We pause paying the "
        "vendor while we look into it.\n",
        "summary": "We hold your money safely until the event is done and the time to "
        "report a problem has passed.",
    },
    "client-report-problem": {
        "body_md": "\n"
        "If something serious went wrong (the vendor did not turn up, a major "
        "quality issue, a safety concern), please report it from the booking "
        "so we can pause paying the vendor and review.\n"
        "\n"
        "> [!IMPORTANT]\n"
        "> Please report it **before the time to report a problem ends**. This "
        "is usually **48 hours** after the event, and **96 hours** for "
        "equipment hire and decorations. The booking shows the exact time. "
        "After that, the vendor may already have been paid.\n"
        "\n"
        "### 1. Open the booking\n"
        "Please open it under **Bookings**, or go to **Disputes** in the "
        "menu.\n"
        "\n"
        "### 2. Report the problem\n"
        "Choose to report a problem. Explain what happened and add photos if "
        "you can. Please don't confirm the event went well.\n"
        "\n"
        "### What happens next\n"
        "Both sides can give their side. Our team then decides. We may pay the "
        "vendor, give you a full or partial refund, or something in between. "
        "If the vendor did not turn up, you get a **full refund**, including "
        "the service fee.\n"
        "\n"
        "Reporting a problem is not for simple questions (use Help or "
        "**Contact**) or for changing your mind before the event (use "
        "**Cancel**).\n",
        "summary": "If something went wrong, report it from your booking before the time "
        "limit. We pause paying the vendor while we help.",
    },
    "client-when-do-i-pay": {
        "body_md": "\n"
        "You pay **after the vendor accepts**. Checkout shows the full total before you confirm payment.\n"
        "\n"
        "> [!NOTE]\n"
        "> The total includes the vendor portion, the **5% Eventtz fee** on that vendor total, and any **referral savings** if you used the vendor's code.\n"
        "\n"
        "### 1. Wait for acceptance\n"
        "The vendor reviews your request and accepts or declines. The date is not held until you pay.\n"
        "\n"
        "### 2. Review the breakdown\n"
        "Open the booking and start checkout. You see:\n"
        "\n"
        "- Vendor portion (packages and agreed changes)\n"
        "- Eventtz fee (5% of the vendor total, minus referral savings if applicable)\n"
        "- **Total due**\n"
        "\n"
        "### 3. Pay before the deadline\n"
        "Pay on the secure payment page. We hold the money until the event is done.\n"
        "\n"
        "Payment is due **72 hours** after the vendor accepts, or **48 hours** before the event if that comes sooner. If the vendor accepts less than 48 hours before the event, you can pay up until the event starts. The booking shows the exact **Pay by** time.\n"
        "\n"
        "> [!WARNING]\n"
        "> If you have not paid by then, the booking is **cancelled** and the vendor's date is released. You are not charged. You can send a new request.\n"
        "\n"
        "After you pay, open a **Payment receipt** from the booking or **Payment history**.\n"
        "\n"
        "If payment fails, try again from the same booking or use **Contact** and include the booking ID.\n",
        "summary": "Pay after the vendor accepts, by the Pay by time on the booking, or it is cancelled and the date released.",
    },
    "vendor-accept-booking": {
        "body_md": "\n"
        "Please respond from **Bookings**. Faster replies win more bookings. We remind you if a request is still waiting, usually after about **1 hour**, **6 hours**, and **24 hours**.\n"
        "\n"
        "> [!NOTE]\n"
        "> The date isn't confirmed for the client until they pay. Accept quickly, then watch for their payment.\n"
        "\n"
        "### 1. Open the request\n"
        "Please open **Bookings**, then the pending request. Read the date, place, packages, and notes. Chat if you need clarity.\n"
        "\n"
        "### 2. Accept or decline\n"
        "**Accept** or **Decline**. If how you get paid isn't ready, Eventtz will ask you to finish bank setup first. After you return from the payments partner, open the booking again to accept.\n"
        "\n"
        "After you accept, the client can pay. The date isn't confirmed for them until they pay. Watch **Messages** and **Notifications**.\n"
        "\n"
        "### 3. If the client doesn't pay\n"
        "Payment is due **72 hours** after you accept, or **48 hours** before the event if that comes sooner. If you accept less than 48 hours before the event, they can pay up until the event starts. The booking shows the **Pay by** time. If they don't pay in time, the booking is cancelled automatically and your date is free again. You don't need to do anything.\n",
        "summary": "Please respond from Bookings once getting paid is set up. The client must then pay by the deadline, or the booking is cancelled.",
    },
    "vendor-complete-cancel": {
        "body_md": "\n"
        "### 1. Confirm after a paid event\n"
        "Please open the booking and confirm **completion** when the work is "
        "done. The client should confirm too when asked.\n"
        "\n"
        "When both of you confirm, payout can start sooner. If nobody reports "
        "a problem, money is released when the **time to report a problem** "
        "ends: usually **48 hours** after the event, and **96 hours** for "
        "equipment hire and decorations.\n"
        "\n"
        "If you set a **two-part payout** for photos or video, the first part "
        "is paid after the event and the rest when the client confirms "
        "delivery, or on your delivery deadline if they have not reported a "
        "problem.\n"
        "\n"
        "If payout setup isn't finished, we hold the payout until you "
        "complete it in **Payments**.\n"
        "\n"
        "## Cancelling\n"
        "\n"
        "> [!WARNING]\n"
        "> If you cancel a **paid** booking, the client gets **all** their "
        "money back, whatever your cancellation policy says. You are not paid "
        "for it.\n"
        "\n"
        "Cancellations by you are counted. If you cancel **2** paid bookings "
        "within **180 days**, our team reviews your account. We take no "
        "further action without warning you first, and there are no fines. "
        "Very serious "
        "reasons we agree with, such as serious illness or an emergency, are "
        "not counted against you. Please **Contact** us before cancelling if "
        "one applies.\n"
        "\n"
        "If the client cancels, your cancellation policy decides how much you "
        "are paid.\n"
        "\n"
        "## Changing the date (rescheduling)\n"
        "You or the client can ask to move an accepted booking to new dates "
        "from the booking. The other person says yes or no. Only the dates "
        "change: the price and payment stay the same. If you are fully booked "
        "on the new day, the move can't go ahead.\n",
        "summary": "Confirm after paid events. If you cancel a paid booking, the client "
        "gets everything back and it counts on your record.",
    },
    "vendor-dispute": {
        "body_md": "\n"
        "You or the client can report a problem from the booking. Eventtz holds the "
        "payment until it is sorted out.\n"
        "\n"
        "> [!IMPORTANT]\n"
        "> Please reply quickly with facts and photos. Payment stays on hold until "
        "the problem is resolved.\n"
        "\n"
        "### 1. Open the dispute\n"
        "Please open **Disputes** or the booking dispute section.\n"
        "\n"
        "### 2. Reply with facts\n"
        "Please reply quickly with facts and evidence. Stay professional in the "
        "thread.\n"
        "\n"
        "### 3. Our team decides\n"
        "Our team may pay you in full, refund the client in full or in part, or "
        "decide something in between. If we find you did not turn up, the client gets "
        "a **full refund** and it counts on your record. You will see notes on the "
        "dispute when available. Keep serious money issues in Eventtz so there is a "
        "clear record.\n"
        "\n"
        "### Damage deposits\n"
        "If you hold a refundable deposit, make a damage claim from the booking "
        "within **7 days** of the event for damage or missing items. Add the "
        "amount and what happened, with proof such as photos. "
        "Our team decides how much of the deposit you get.\n",
        "summary": "Either side can report a problem. Payment is held while our team decides.",
    },
    "vendor-package-quality": {
        "body_md": "\n"
        "Each **package** is one bookable service with a name, price, and **What's included** text. Clients need enough detail to know what they are booking.\n"
        "\n"
        "A good package has a clear name (for example \"Full day wedding photography\"), a price, **What's included** with real detail (hours, deliverables, travel rules), and a profile photo on your account before you submit. Some categories (such as catering or baking) need at least one complete package before you can submit.\n"
        "\n"
        "On **Pricing**, open **Help me improve my packages**. Eventtz reviews your packages and can suggest clearer names and descriptions. Review the changes, then save.\n"
        "\n"
        "> [!NOTE]\n"
        "> AI can make mistakes. Please always check prices and details before you submit.\n"
        "\n"
        "On **Review**, you can **Generate bio with AI** or write your own. Keep it honest and under the word limit shown on screen. If we return your profile for edits, fix the items in the email and Eventtz Support message, then submit again from **Profile**.\n"
        "\n"
        "## Optional booking rules\n"
        "On **Pricing** you can also set:\n"
        "\n"
        "- **Refundable damage deposit** (equipment hire and decorations only), up to **£1,000**. The client pays it with the booking. It goes back to them automatically **7 days** after the event, unless you report damage or missing items in that time with proof, such as photos. Our team then decides how much you get, never more than the deposit.\n"
        "- **Two-part payout** (photos and video only). Choose how much is paid after the event, between **50%** and **80%**, and a delivery deadline of up to **60 days**. The rest is paid when the client confirms they received the photos or video, or when your deadline passes without a reported problem.\n"
        "\n"
        "These rules are fixed for a booking when the client pays, even if you change them later.\n",
        "summary": "Build clear packages, set optional deposits or two-part payouts, and use AI tools on Pricing and Review.",
    },
    "vendor-stripe-payouts": {
        "body_md": "\n"
        "You'll need to finish payout setup before you can accept a client "
        "booking. That way money can move safely after the event.\n"
        "\n"
        "> [!WARNING]\n"
        "> If payout setup isn't finished when a booking is ready to pay out, "
        "we **hold** the money until you complete it.\n"
        "\n"
        "Please open **Payments**, or follow the prompt when you try to "
        "**accept** a booking.\n"
        "\n"
        "### 1. Start payout setup\n"
        "Please start from **Payout account**.\n"
        "\n"
        "### 2. Complete identity and bank details\n"
        "Please finish the steps with our payments partner, then return to "
        "Eventtz and wait until setup shows as ready.\n"
        "\n"
        "If payout setup is still open about **24 hours** after we approve "
        "you, we email a reminder to finish it.\n"
        "\n"
        "When everyone confirms (or when the time to report a problem ends "
        "with no problem), money goes to your bank on the payments partner's "
        "schedule. If both sides confirmed but payout setup isn't ready, we "
        "**hold** the payout until you finish it.\n",
        "summary": "Please finish how you get paid before you accept. We'll nudge you if "
        "setup is still open.",
    },
    "vendor-when-get-paid": {
        "body_md": "\n"
        "The client pays after you accept. Eventtz holds the money. After the "
        "event, you and the client confirm it went well. If nobody reports a "
        "problem, money is also released when the **time to report a problem** "
        "ends: usually **48 hours** after the event, and **96 hours** for "
        "equipment hire and decorations. Then money goes to your bank on the "
        "payments partner's schedule.\n"
        "\n"
        "> [!NOTE]\n"
        "> If both of you confirmed but **Payments** isn't ready, we hold the "
        "payout until you finish setup.\n"
        "\n"
        "When **both** of you confirm, payout can start sooner. We also send an "
        "**event tomorrow** reminder the day before a paid booking.\n"
        "\n"
        "## Two-part payouts for photos and video\n"
        "Photographers and videographers can choose to be paid in two parts. "
        "You pick the first part (between **50%** and **80%**), paid after the "
        "event. The rest is paid when the client confirms they got the photos "
        "or video, or on your delivery deadline (up to **60 days**) if they "
        "have not reported a problem. Set this up in your profile pricing.\n"
        "\n"
        "## If payout is held\n"
        "\n"
        "If you and the client both confirmed but how you get paid isn't ready, "
        "we hold the payout and notify you. Open **Payments** and finish payout "
        "setup so we can send the funds.\n"
        "\n"
        "Other delays include an open dispute, paused payment, or bank checks "
        "still in progress. Check **Payments** and the booking. Use **Contact** "
        "with the booking ID if money is late after it should have been "
        "released.\n",
        "summary": "After both sides confirm, or when the time to report a problem ends. "
        "Held if payout setup isn't finished yet.",
    },
}

# The 0002 text, restored on downgrade.
OLD_ARTICLES: dict[str, dict[str, str]] = {
    "client-accept-quote": {
        "body_md": "\n"
        "While you are still deciding, a vendor may send a custom quote from "
        "chat, or a price update for extras or a discount.\n"
        "\n"
        "> [!NOTE]\n"
        "> Please read the new total carefully. You only pay after you "
        "**accept** the price and the vendor has accepted the booking.\n"
        "\n"
        "### 1. Open the booking\n"
        "Please open the booking under **Bookings** and read the new total "
        "carefully.\n"
        "\n"
        "### 2. Accept or decline\n"
        "**Accept** if you agree, or **Decline** if you do not.\n"
        "\n"
        "You only pay after you and the vendor agree the price, and they have "
        "accepted the booking. If you decline, keep chatting or cancel that "
        "request if you are done with that vendor.\n",
        "summary": "Please respond when a vendor sends a new quote or price change.",
    },
    "client-cancel-refund": {
        "body_md": "\n"
        "Please open the booking and use **Cancel** when it is allowed.\n"
        "\n"
        "Common cases:\n"
        "\n"
        "- You asked but the vendor has not accepted yet.\n"
        "- They accepted but you have not paid yet.\n"
        "- You paid, but money has not been released to the vendor yet.\n"
        "\n"
        "## If you already paid\n"
        "\n"
        "If you cancel before the vendor is paid, you'll get a **full refund** "
        "to your card. Banks often take **5 to 10 working days** to show it. If "
        "the vendor cancels after you paid, we refund you.\n"
        "\n"
        "> [!NOTE]\n"
        "> Please don't use cancel for a problem after the day. Open a "
        "**dispute** from the booking so we can pause paying the vendor and "
        "help.\n"
        "\n"
        "Please use **Contact** if something looks wrong.\n",
        "summary": "Cancel before the vendor is paid and you'll get a full refund.",
    },
    "client-complete-booking": {
        "body_md": "\n"
        "For a paid booking, we send an **event tomorrow** reminder the day "
        "before so you have time, venue, and messages in one place.\n"
        "\n"
        "### 1. Open the booking\n"
        "After the event, please open the booking under **Bookings**.\n"
        "\n"
        "### 2. Confirm it went well\n"
        "Please confirm it is complete when asked. The vendor should confirm "
        "on their side too. When **both** of you confirm, the vendor can be "
        "paid sooner.\n"
        "\n"
        "If nobody reports a problem, money can go to the vendor about **48 "
        "hours** after the event.\n"
        "\n"
        "> [!WARNING]\n"
        "> If something went wrong, please don't confirm. Please open a "
        "**dispute** from the booking so we can hold the money and review.\n"
        "\n"
        "After a successful booking you may be asked to leave a review.\n",
        "summary": "Confirm after your event so the vendor can be paid. We'll remind you the day before too.",
    },
    "client-payment-safe": {
        "body_md": "\n"
        "When you pay, Eventtz holds the money safely for you. The vendor is not "
        "paid the moment you pay. You pay on a secure payment page. Eventtz "
        "doesn't keep your full card number.\n"
        "\n"
        "> [!NOTE]\n"
        "> Your money stays protected until the event is done and any problems "
        "are resolved.\n"
        "\n"
        "Money can be released when you and the vendor both say the event went "
        "well, or about **48 hours** after the event if nobody reports a "
        "problem.\n"
        "\n"
        "If there is a problem, report it from the booking (**Disputes**). We "
        "can pause paying the vendor while we look into it.\n",
        "summary": "We hold your money safely until your event is done.",
    },
    "client-report-problem": {
        "body_md": "\n"
        "If something serious went wrong (no-show, major quality issue, safety "
        "concern), don't worry. Please report it from the booking so we can "
        "pause paying the vendor and review.\n"
        "\n"
        "> [!IMPORTANT]\n"
        "> Please open a **dispute** instead of confirming the event went "
        "well. Confirming tells us the booking finished successfully.\n"
        "\n"
        "### 1. Open the booking\n"
        "Please open it under **Bookings**, or go to **Disputes** in the "
        "menu.\n"
        "\n"
        "### 2. Report the problem\n"
        "Please choose to report a problem / open a dispute. Explain what "
        "happened and add photos if you can.\n"
        "\n"
        "We review the case and may **pause paying the vendor** until it is "
        "sorted. Check the dispute for updates.\n"
        "\n"
        "Disputes aren't for simple how-to questions (use Help or **Contact**) "
        "or changing your mind before the event when cancel still works.\n",
        "summary": "If something went wrong, please report it from your booking. We may "
        "pause paying the vendor while we help.",
    },
    "client-when-do-i-pay": {
        "body_md": "\n"
        "You pay **after the vendor accepts**. Checkout shows the full total before you confirm payment.\n"
        "\n"
        "> [!NOTE]\n"
        "> The total includes the vendor portion, the **5% Eventtz fee** on that vendor total, and any **referral savings** if you used the vendor's code.\n"
        "\n"
        "### 1. Wait for acceptance\n"
        "The vendor reviews your request and accepts or declines. The date is not held until you pay.\n"
        "\n"
        "### 2. Review the breakdown\n"
        "Open the booking and start checkout. You see:\n"
        "\n"
        "- Vendor portion (packages and agreed changes)\n"
        "- Eventtz fee (5% of the vendor total, minus referral savings if applicable)\n"
        "- **Total due**\n"
        "\n"
        "### 3. Pay securely\n"
        "Pay on the secure payment page. We hold the money until the event is done.\n"
        "\n"
        "If you have not paid about **24 hours** after they accept, we remind you to pay to confirm the date.\n"
        "\n"
        "> [!WARNING]\n"
        "> If you wait too long, another client could book the same date with that vendor.\n"
        "\n"
        "After you pay, open a **Payment receipt** from the booking or **Payment history**.\n"
        "\n"
        "If payment fails, try again from the same booking or use **Contact** and include the booking ID.\n",
        "summary": "Pay after the vendor accepts. Your date isn't held until payment goes through.",
    },
    "vendor-accept-booking": {
        "body_md": "\n"
        "Please respond from **Bookings**. Faster replies win more bookings. We remind you if a request is still waiting, usually after about **1 hour**, **6 hours**, and **24 hours**.\n"
        "\n"
        "> [!NOTE]\n"
        "> The date isn't confirmed for the client until they pay. Accept quickly, then watch for their payment.\n"
        "\n"
        "### 1. Open the request\n"
        "Please open **Bookings**, then the pending request. Read the date, place, packages, and notes. Chat if you need clarity.\n"
        "\n"
        "### 2. Accept or decline\n"
        "**Accept** or **Decline**. If how you get paid isn't ready, Eventtz will ask you to finish bank setup first. After you return from the payments partner, open the booking again to accept.\n"
        "\n"
        "After you accept, the client can pay. The date isn't confirmed for them until they pay. Watch **Messages** and **Notifications**.\n",
        "summary": "Please respond from Bookings once getting paid is set up. We'll remind you if a request is waiting.",
    },
    "vendor-complete-cancel": {
        "body_md": "\n"
        "### 1. Confirm after a paid event\n"
        "Please open the booking and confirm **completion** when the work is "
        "done. The client should confirm too when asked.\n"
        "\n"
        "When both of you confirm, payout can start sooner. If nobody reports "
        "a problem, money can be released about **48 hours** after the "
        "event.\n"
        "\n"
        "If payout setup isn't finished, we hold the payout until you "
        "complete it in **Payments**.\n"
        "\n"
        "## Cancelling\n"
        "\n"
        "> [!WARNING]\n"
        "> Cancelling a **paid** booking may trigger a refund to the client. "
        "Check the buttons on that booking before you confirm.\n"
        "\n"
        "Please use cancel on the booking when it is allowed. Rules differ "
        "for unpaid requests vs paid bookings. Check the buttons on that "
        "booking.\n"
        "\n"
        "If the client had already paid and a refund is due, Eventtz handles "
        "the refund for that booking state. Use **Contact** if something "
        "looks stuck.\n",
        "summary": "Confirm after paid events. Payout may wait if payout setup isn't finished yet.",
    },
    "vendor-dispute": {
        "body_md": "\n"
        "You or the client can report a problem from the booking. Eventtz reviews it "
        "and may **hold payment** until it is sorted.\n"
        "\n"
        "> [!IMPORTANT]\n"
        "> Please reply quickly with facts and photos. Payment may stay on hold until "
        "the dispute is resolved.\n"
        "\n"
        "### 1. Open the dispute\n"
        "Please open **Disputes** or the booking dispute section.\n"
        "\n"
        "### 2. Reply with facts\n"
        "Please reply quickly with facts and evidence. Stay professional in the "
        "thread.\n"
        "\n"
        "Our team may leave things as they are, issue a partial refund, or take other "
        "actions depending on the case. You will see notes on the dispute when "
        "available. Keep serious money issues in Eventtz so there is a clear "
        "record.\n",
        "summary": "Either side can report a problem. Payment may be held while we help.",
    },
    "vendor-package-quality": {
        "body_md": "\n"
        "Each **package** is one bookable service with a name, price, and **What's included** text. Clients need enough detail to know what they are booking.\n"
        "\n"
        "A good package has a clear name (for example \"Full day wedding photography\"), a price, **What's included** with real detail (hours, deliverables, travel rules), and a profile photo on your account before you submit. Some categories (such as catering or baking) need at least one complete package before you can submit.\n"
        "\n"
        "On **Pricing**, open **Help me improve my packages**. Eventtz reviews your packages and can suggest clearer names and descriptions. Review the changes, then save.\n"
        "\n"
        "> [!NOTE]\n"
        "> AI can make mistakes. Please always check prices and details before you submit.\n"
        "\n"
        "On **Review**, you can **Generate bio with AI** or write your own. Keep it honest and under the word limit shown on screen. If we return your profile for edits, fix the items in the email and Eventtz Support message, then submit again from **Profile**.\n",
        "summary": "Build clear packages and use AI tools on Pricing and Review.",
    },
    "vendor-stripe-payouts": {
        "body_md": "\n"
        "You'll need to finish payout setup before you can accept a client "
        "booking. That way money can move safely after the event. That way "
        "money can move safely after the event.\n"
        "\n"
        "> [!WARNING]\n"
        "> If payout setup isn't finished when a booking is ready to pay out, "
        "we **hold** the money until you complete it.\n"
        "\n"
        "Please open **Payments**, or follow the prompt when you try to "
        "**accept** a booking.\n"
        "\n"
        "### 1. Start payout setup\n"
        "Please start from **Payout account**.\n"
        "\n"
        "### 2. Complete identity and bank details\n"
        "Please finish the steps with our payments partner, then return to "
        "Eventtz and wait until setup shows as ready.\n"
        "\n"
        "If payout setup is still open about **24 hours** after we approve "
        "you, we email a reminder to finish it.\n"
        "\n"
        "When everyone confirms (or about **48 hours** after the event with no "
        "problem), money goes to your bank on the payments partner's schedule. "
        "If both sides confirmed but payout setup isn't ready, we **hold** the "
        "payout until you finish it.\n",
        "summary": "Please finish how you get paid before you accept. We'll nudge you if "
        "setup is still open.",
    },
    "vendor-when-get-paid": {
        "body_md": "\n"
        "The client pays after you accept. Eventtz holds the money. After the "
        "event, you and/or the client confirm it went well. If there is no "
        "problem, money can also release about **48 hours** after the event. "
        "Then money goes to your bank on the payments partner's schedule.\n"
        "\n"
        "> [!NOTE]\n"
        "> If both of you confirmed but **Payments** isn't ready, we hold the "
        "payout until you finish setup.\n"
        "\n"
        "When **both** of you confirm, payout can start sooner. We also send an "
        "**event tomorrow** reminder the day before a paid booking.\n"
        "\n"
        "## If payout is held\n"
        "\n"
        "If you and the client both confirmed but how you get paid isn't ready, "
        "we hold the payout and notify you. Open **Payments** and finish payout "
        "setup so we can send the funds.\n"
        "\n"
        "Other delays include an open dispute, paused payment, or bank checks "
        "still in progress. Check **Payments** and the booking. Use **Contact** "
        "with the booking ID if money is late after it should have been "
        "released.\n",
        "summary": "After both sides confirm, or about 48 hours later. Held if payout "
        "setup isn't finished yet.",
    },
}


def _write_articles(articles: dict[str, dict[str, str]]) -> None:
    """Set the summary and body of each article, by slug."""
    statement = sa.text(
        "UPDATE public.help_articles SET summary = :summary, body_md = :body_md, updated_at = now()"
        " WHERE slug = :slug"
    )
    for slug, article in articles.items():
        op.execute(statement.bindparams(slug=slug, summary=article["summary"], body_md=article["body_md"]))


def upgrade() -> None:
    """Rewrite the articles to match the 2026-11-01 Terms."""
    _write_articles(NEW_ARTICLES)


def downgrade() -> None:
    """Put back the text seeded by 0002."""
    _write_articles(OLD_ARTICLES)
