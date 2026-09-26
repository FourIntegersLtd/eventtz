# marketplace

## Purpose
How clients find vendors: the explore list, search (with the language model reading free text into
filters or an event checklist), a vendor's public page and reviews, saved vendors, UK address lookup,
the vendor's own analytics screen, and the funnel events those screens record.

## Use cases
- As a **visitor**, I **browse listed vendors in my market** so that I can see who is available.
- As a **visitor**, I **search in plain words** ("wedding in Leeds under £2k") and get ranked vendors,
  or a checklist of sections when I describe a whole event.
- As a **visitor**, I **open a vendor's page and read their reviews**.
- As a **client**, I **save vendors** and keep the ones I saved before signing in.
- As a **vendor**, I **see my enquiries, conversion, revenue, ratings and reply times** over a period.

## Invariants
- Only publicly listed vendors appear, through `vendors.service_listing` (never a hand-written
  `approval_status` filter). QA vendors are shown only to the QA clients configured for them.
- The model's reading of a query is sanitised before use; any failure falls back to the query's words.
- Recording a funnel event never breaks the request that records it.
- Money stays in pounds as stored on bookings; ratios are rounded as the baseline rounds them.

## Routes
`GET /vendors/explore`, `GET /vendors/explore/search`, `GET /vendors/explore/vendor/{vendor_user_id}`,
`GET /vendors/{vendor_user_id}/reviews`, `GET/POST/PUT/DELETE /client/favorites…`,
`GET /client/geo/address-find|address-autocomplete|address-resolve/{address_id}`, `GET /vendor/analytics`.

Baseline behaviour kept on purpose (the freeze tests pin it):
- Explore rows include the vendor's account email, as the baseline does. Worth removing once the web
  no longer reads it.
- Address lookup is switched off: find and autocomplete return empty lists with
  `provider_configured=false`, and resolve always answers 404.
- QA vendors a QA client may see are appended to search results without applying the search filters.
- Public reviews answer for any vendor id, listed or not.

Differences from the baseline:
- The baseline capped analytics at 500 enquiries and 5000 profile views; the counts here are exact.
- `celebration_plan_*` events are not recorded: the table's CHECK constraint rejects them, so the
  baseline's inserts silently failed.
