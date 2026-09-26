# planner

## Purpose
A client's events (celebrations such as a wedding or a birthday) and, later, the plans that group
several vendors' bookings under one event. Rebuilt in stages: this first cut serves bookings only.

## Use cases
- As a **client**, when I **send a booking request**, it is filed under the event I picked, or under a
  new event made from the request's name, dates and venue.
- As a **client**, I **see each booking's event title** in my bookings list.

## Invariants
- A client can only file bookings under their own, active events.
- A picked event's stored name, dates and venue win over what the request typed (as in the baseline).

## Routes
None yet. The planner routes (`/client/events…`, `/client/celebration-plans…`) follow in the planner
rebuild; until then they are served by the baseline only.
