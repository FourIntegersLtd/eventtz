"""Reviews: a client's one-time rating and comment on a completed booking.

Owns `booking_reviews` and the six routes that read and moderate it:
submitting a review, the client's and vendor's own lists, and the admin
moderation endpoints (list, detail, hide/unhide). Bookings, marketplace and
explore keep reading `booking_reviews` through their own table handles until
the integration workstream swaps them over to this slice's service.
"""

from __future__ import annotations
