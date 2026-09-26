# messaging

## Purpose
Chat between clients and vendors (one DM thread per pair), and Eventtz Support: one thread per end
user where staff message them. Covers the inbox, messages, read state, unread badges, staff
broadcasts, replies and edits, and the staff viewer for any thread.

## Use cases
- As a **client**, I **message a listed vendor**, and see their business name in my inbox.
- As a **vendor**, I **message a client who has enquired with me**, and my first reply on an
  enquiry records my response time.
- As a **client or vendor**, I **read my Eventtz Support thread** and reply to it; staff appear as
  "Eventtz Admin", never by name or email.
- As **staff**, I **message one or more users** (super admins: every client, vendor or user), and
  each gets an email copy linking to their inbox.
- As **staff**, I **work the support inbox**: read, reply, edit my own messages, mark read.
- As **staff**, I **open any thread** to investigate a dispute. The view is audited.

## Invariants
- Only participants see or post on a thread. Someone else's thread id answers "not found".
- A DM's client is always `client_user_id`, and its vendor must be a vendor account. Clients may
  message only publicly listed vendors (checked through `vendors.service_listing`).
- Unread = messages from others after the reader's cursor. The support user reads with
  `client_last_read_at`; all staff share `admin_last_read_at`. Cursors and `last_message_at`
  use the database clock, so they never disagree with message timestamps.
- Staff messages are sanitised HTML (`domain_sanitize`, ported byte for byte) with
  `metadata = {"kind": "admin", "format": "html"}`. 5000 visible characters; 15000 stored.
- Every staff action writes an audit event: `chat.admin_send`, `chat.admin_reply`,
  `chat.admin_edit`, `chat.view`.
- A support email never fails the send.

## Routes
`GET /chat/unread-count`, `GET/POST /chat/conversations`, `GET /chat/conversations/{id}`,
`GET/POST /chat/conversations/{id}/messages`, `POST /chat/conversations/{id}/read`,
`POST /admin/messages/send`, `GET /admin/messages/conversations`,
`GET /admin/messages/conversations/{id}`, `GET/POST /admin/messages/conversations/{id}/messages`,
`PATCH /admin/messages/conversations/{id}/messages/{message_id}`,
`POST /admin/messages/conversations/{id}/read`, `GET /admin/chat/conversations/{id}/messages`.

Baseline behaviour kept on purpose (the freeze tests pin it):
- When a vendor opens a DM, the returned row is shaped for the client (the peer is the vendor
  themselves). The web reads only the id.
- Sending to an unknown thread is 400, not 404, and so is sending to someone else's thread.
  Marking someone else's thread read is 403.
- The staff viewer answers 200 with no messages for an unknown id.
- `vendor_message_sent` is recorded on every vendor reply on an open enquiry thread, not only
  the first.

Differences from the baseline:
- Staff broadcasts skip closed accounts (tombstones), and "vendors" means `users.user_type =
  'vendor'`. The baseline also added every `vendors.user_id`, which only differs for accounts
  whose type was changed by hand.
- An unknown recipient id fails with "Could not start support conversation." rather than the raw
  database error text.
- Marking a thread read also refreshes the reader's badge in their other tabs.
- The baseline's 503 "could not load/update" answers are gone: a database failure is a 500, and
  the whole request rolls back.
- `booking_requests` is read and written through a table handle in `repository_bookings.py` until
  bookings is rebuilt; those two functions then move behind the bookings service.
