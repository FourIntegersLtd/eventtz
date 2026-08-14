# Eventtz backend naming — plain-English rules

**Your rule:** Names must be **descriptive** and **understandable immediately** — no decoding abbreviations in your head.

If you have to ask “what is `pb`?” or “what is `row0`?”, the name failed.

---

## The 10-second test

Before keeping a name, ask:

1. **Can I guess what it holds from the name alone?**
2. **Would a new developer (or future me) get it without opening the function?**
3. **Is it specific enough?** (`payload` → *whose* payload? vendor profile? request body?)

If any answer is no → rename when you touch that file.

---

## Do ✅

| Instead of | Use |
|------------|-----|
| `pb` | `pricing_breakdown` |
| `li` | `line_item` |
| `row0` | `booking_row` or `existing_booking` |
| `q` | `search_query` or `search_term` |
| `vid` / `cid` | `vendor_user_id` / `client_user_id` |
| `bid` | `booking_id` |
| `res` | `query_result` or `insert_result` |
| `vpayload` | `vendor_profile_payload` |
| `raw_adj` | `raw_adjustments` |
| `payload` (vague) | `vendor_profile`, `request_body`, `form_payload` |

**Functions:** verb + noun — `create_booking_request`, `get_booking_for_client`, `build_pricing_breakdown`.

**Booleans:** read as a question — `is_pending`, `has_pricing_tbc`, `client_price_confirmation_required`.

**IDs:** always say what entity — `booking_id`, `vendor_user_id`, never bare `id` in function params when multiple ids exist.

---

## Avoid ❌

- Abbreviations that aren’t universal (`pb`, `adj`, `ctx` unless `search_context` is too long *and* scoped)
- Numbered temps (`row0`, `item1`) — use role names
- Single-letter variables outside tiny loops
- Same word for different things (`booking` = row? status? API object?)
- Cryptic prefixes without domain (`_enforce_*` is OK if the verb is clear)

---

## Layers (stay consistent)

| Layer | Path | Style |
|-------|------|--------|
| Contracts | `backend/app/contracts/` | `CreateBookingRequestBody`, `unit_price_gbp` |
| HTTP | `features/*/http/` | Thin; same names as contracts |
| Logic | `features/*/` | `verb_noun`, full words |
| DB client | `get_db().table("booking_requests")` | Table name = plural snake_case |

---

## When renaming

1. **One feature folder at a time** (e.g. `bookings/` first)
2. **No behaviour changes** — rename only
3. **Run tests** after each batch: `cd backend && poetry run pytest tests/ -q`
4. **Don’t rename JSON/API fields** without a migration plan (breaking)

Full audit prompt: [audits/backend-naming-audit-prompt.md](./audits/backend-naming-audit-prompt.md)
