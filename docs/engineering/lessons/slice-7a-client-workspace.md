# Slice 7a — Client workspace

### User story

A **signed-in client** opens `/client/dashboard` and sees what needs attention right now: vendor quotes to accept, completion confirmations, unread messages, booking notifications, and review nudges. They use the **AI planner** at `/client/planner` to turn a natural-language brief into vendor recommendations and a budget breakdown, then hand off to browse or a single-vendor enquire with a linked **`client_events`** row so Slice 3a pre-fills event fields. They save vendors on **`/client/favorites`** and reuse celebration context across bookings without a dedicated events page.

**Prerequisites:** Slice 1 (auth/session), Slice 2 (browse), Slice 3a (enquire + `useActiveEventPrefill`).

---

## What changed since last lesson (2026-08-31)

| Area | Before | Now |
|------|--------|-----|
| Bookings list ordering | Implicit / `created_at` | `sortBookingListItemsRecentFirst` — `updated_at` then `created_at` (Slice 3b scaffold) |
| Booking detail header | Event name + badges only | `Ref {shortId}` + `CopyToClipboardButton` in shared `BookingDetailPanel` (Slice 3b) |

Plain English: dashboard attention feed is unchanged; the **bookings master-detail** under `/client/bookings` now surfaces recent activity and a copyable booking reference — see Slice 3b for the shared list/detail shell.

List ordering (shared bookings scaffold):

```13:24:frontend/features/bookings/bookingListOrder.ts
export function compareBookingsRecentFirst(
  a: BookingListActivityFields,
  b: BookingListActivityFields,
): number {
  return bookingListActivityTimestamp(b).localeCompare(bookingListActivityTimestamp(a));
}

export function sortBookingListItemsRecentFirst<T extends BookingListActivityFields>(
  items: T[],
): T[] {
  return [...items].sort(compareBookingsRecentFirst);
}
```

Used by `useParticipantBookingsScaffold` when loading client/vendor booking lists.

---

## What the client workspace does

```typescript
// Dashboard: aggregate bookings + notifications into one attention feed
const { activeBookings, updates, needsReview } = useClientDashboard(Boolean(user?.id));

// Planner: prompt → plan → ensure client_events → browse or book
const plan = await createCelebrationPlan(prompt);
const ensured = await ensurePlanClientEvent(plan.plan_id);
router.push(buildPlannerVendorBookUrl(vendorUserId, plan, ensured.event_id));
```

| Piece | Role |
|--------|------|
| `ClientDashboardView` | Next-event hero + attention feed + bookings calendar |
| `useClientDashboard` | Loads active/completed bookings, notification feed, chat unread; subscribes to SSE refresh |
| `AttentionFeedCard` | Priority-sorted actionable rows (quotes, completion, reviews) |
| `client_events` | Glue table — groups multi-vendor bookings under one celebration |
| `clientPlannerApi` | `POST/GET /client/planner/plans` + `ensure-event` |
| `ensurePlanClientEvent` | Creates/links `client_events` before first booking from a plan |
| `useActiveEventPrefill` | Banner or silent prefill for enquire modals (Slice 3a) |
| `clientFavoritesApi` | Saved vendor IDs; favorites page reuses marketplace explore |

Plain English: the dashboard is a **todo list for celebrations**, not a second bookings list. The planner is a **structured brief + vendor shortlist** that always links to a `client_events` row before enquire so every booking from that plan shares event name, date, and venue.

---

## What happens at a glance

```
Client opens /client/dashboard
    → useClientDashboard: fetch active + completed bookings, notification feed, chat unread
    → build attentionItems (quotes, completion, chat, notifications, review nudges)
    → SSE events (bookings:refresh, etc.) trigger reload

Client opens /client/planner
    → types prompt → POST /api/v1/client/planner/plans
        → plan_service.generate_plan: parse prompt, rank vendors, budget bands
    → router.replace(/client/planner/{planId})
    → Book now / Browse all:
        → ensurePlanClientEvent(planId) if no client_event_id yet
            → client_events row + celebration_plans.client_event_id
        → buildPlannerVendorBookUrl or buildPlannerBrowseUrl with event_id
    → VendorBookingModal (Slice 3a) receives linkedEventId
        → useActiveEventPrefill auto-applies fields (no banner)

Client saves vendor on browse
    → PUT /api/v1/client/favorites/{vendorUserId}
    → /client/favorites shows MarketplaceExploreView mode="favorites"

First enquire without planner
    → resolve_event_for_booking creates client_events row
    → later dashboard may offer "Use your celebration" banner via useActiveEventPrefill
```

---

## Example: planner → enquire with shared event

1. Client visits `/client/planner?q=200 guest wedding in Manchester June 2026`.
2. `createCelebrationPlan` returns `plan_id` with catering, photography, venue recommendations.
3. Client clicks **Book now** on the photographer → `ensurePlanClientEvent` creates `client_events` row `evt-xyz`.
4. Browser navigates to `/client/browse/{vendorId}?eventName=…&dates=…&event_id=evt-xyz&fromPlanner=…`.
5. `VendorBookingModal` gets `linkedEventId={evt-xyz}` → `useActiveEventPrefill` loads event and pre-fills form silently.
6. Client sends enquire → `create_booking_request` links `event_id=evt-xyz`.
7. Client books caterer from same plan → same `event_id`; dashboard calendar shows both bookings on event dates.

---

## Complete route — dashboard

### Frontend

1. `frontend/app/client/(portal)/dashboard/page.tsx` — thin route shell
2. `frontend/features/client/dashboard/ClientDashboardView.tsx` — layout + attention feed composition
3. `frontend/features/client/dashboard/useClientDashboard.ts` — data loader + SSE refresh
4. `frontend/features/client/dashboard/ClientBookingsCalendarCard.tsx` — month grid + agenda
5. `frontend/features/dashboard/AttentionFeedCard.tsx` — shared attention list UI
6. `frontend/features/dashboard/attentionFeedHelpers.ts` — dedupe notification rows
7. `frontend/features/dashboard/attentionTypes.ts` — `AttentionItem` shape
8. `frontend/lib/clientBookingsApi.ts` — `fetchClientBookings("active" | "completed")`
9. `frontend/lib/notificationsFeedApi.ts` — `fetchClientNotificationsFeed`
10. `frontend/lib/clientNotificationsApi.ts` — unread counts
11. `frontend/lib/chatApi.ts` — `fetchChatUnreadCount`
12. `frontend/lib/realtimeHooks.ts` — `useRealtimeRefresh` (Slice 7b)

### Backend (read-only for dashboard)

13. `backend/app/features/bookings/http/client.py` — booking list endpoints
14. `backend/app/features/notifications/feed.py` — notification feed assembly
15. `backend/app/features/chat/http/routes.py` — unread count

---

## Complete route — AI planner

### Frontend

1. `frontend/app/client/(portal)/planner/page.tsx` — new plan (`AiPlannerView`)
2. `frontend/app/client/(portal)/planner/[planId]/page.tsx` — existing plan detail
3. `frontend/features/client/planner/AiPlannerView.tsx` — prompt hero, results, handoff buttons
4. `frontend/features/client/planner/useGeneratePlan.ts` — generate/list/load/replace state
5. `frontend/features/client/planner/plannerModel.ts` — `buildPlannerBrowseUrl`, `primaryVendorsFromPlan`
6. `frontend/features/client/planner/PlannerBookNowButton.tsx` — single-vendor handoff
7. `frontend/features/client/planner/RecommendationSection.tsx` — per-need vendor cards
8. `frontend/features/client/planner/BudgetBreakdown.tsx` — budget lines
9. `frontend/lib/clientPlannerApi.ts` — all planner HTTP calls
10. `frontend/features/bookings/eventEnquirePrefill.ts` — plan → enquire field mapping

### Backend

11. `backend/app/features/planner/http/routes.py` — `/client/planner/plans` CRUD + ensure-event
12. `backend/app/features/planner/plan_service.py` — generate, list, replace, archive
13. `backend/app/features/planner/event_link.py` — `ensure_client_event_for_plan`
14. `backend/app/features/planner/prompt_parser.py` — natural language → `CelebrationBrief`
15. `backend/app/features/planner/explore_vendor_adapter.py` — marketplace vendor pool for ranking
16. `backend/sql/` — `celebration_plans`, `client_events` migrations

---

## Complete route — client_events glue

There is **no** `/client/events` page. Events exist as API rows linked from bookings and planner.

### Frontend

1. `frontend/lib/clientEventsApi.ts` — `fetchClientEvents`, `fetchClientEventById`, `pickPrimaryClientEvent`
2. `frontend/features/bookings/useActiveEventPrefill.ts` — banner + linked prefill for enquire
3. `frontend/features/bookings/eventEnquirePrefill.ts` — planner URL param builders

### Backend

4. `backend/app/features/client_events/http/routes.py` — `GET /client/events`, `GET /client/events/{id}`
5. `backend/app/features/client_events/events.py` — `create_client_event`, `resolve_event_for_booking`
6. `backend/app/features/bookings/create.py` — calls `resolve_event_for_booking` on enquire

---

## Complete route — favorites

### Frontend

1. `frontend/app/client/(portal)/favorites/page.tsx` — `MarketplaceExploreView mode="favorites"`
2. `frontend/lib/clientFavoritesApi.ts` — list/add/remove/merge favorites
3. `frontend/features/marketplace/useMarketplaceBookmarks.ts` — heart toggle on browse cards

### Backend

4. `backend/app/features/favorites/http/client.py` — `GET/PUT/DELETE /client/favorites`
5. `backend/app/features/favorites/service.py` — `saved_vendors` table access

---

## Step 1 — Dashboard data load

**File:** `useClientDashboard.ts` — parallel fetch on mount and SSE refresh:

```93:103:frontend/features/client/dashboard/useClientDashboard.ts
  const load = useCallback(async () => {
    if (!enabled) return;
    setState((s) => ({ ...s, loadStatus: "loading", errorMessage: null }));
    try {
      const [active, completed, bookingNotificationsUnread, chatUnread, updates] = await Promise.all([
        fetchClientBookings("active"),
        fetchClientBookings("completed"),
        fetchClientBookingNotificationsUnreadCount(),
        fetchChatUnreadCount(),
        fetchClientNotificationsFeed(),
      ]);
```

Realtime subscription — dashboard reloads when bookings, chat, notifications, or disputes change (Slice 7b):

```194:198:frontend/features/client/dashboard/useClientDashboard.ts
  useRealtimeRefresh(
    ["bookings:refresh", "chat:unread_refresh", "booking_notifications:refresh", "disputes:refresh"],
    () => void load(),
    [enabled, load],
  );
```

Visibility refresh — tab focus also reloads (mobile backgrounding):

```187:192:frontend/features/client/dashboard/useClientDashboard.ts
  useEffect(() => {
    if (!enabled) return;
    return installVisibilityRefresh(() => {
      void load();
    });
  }, [enabled, load]);
```

---

## Step 2 — Attention feed priorities

**File:** `ClientDashboardView.tsx` — builds `attentionItems` with explicit priority ordering:

| Priority | Source | Example |
|----------|--------|---------|
| 0 (urgent) | Vendor quote pending | "Quote from {vendor}" → booking detail |
| 0 (urgent) | Client must confirm completion | Post-event confirmation CTA |
| 1 (urgent) | Chat unread | "{n} unread messages" |
| 2 (info) | Completion waiting on vendor | Informational row |
| 2 (info) | Notification feed (deduped) | Booking status updates |
| 3 (positive) | Needs review | Star rating nudge → `?rate={n}` |

Vendor quote rows (highest urgency):

```63:74:frontend/features/client/dashboard/ClientDashboardView.tsx
    for (const b of activeBookings) {
      if (b.initiator === "vendor" && b.booking_status === "pending") {
        items.push({
          id: `quote-${b.booking_request_id}`,
          priority: 0,
          tone: "urgent",
          title: CLIENT_DASHBOARD_COPY.quoteTitle(b.vendor_display_name),
          subtitle: `${b.event_name} · ${formatEventDate(b.event_date)}`,
          href: `/client/bookings/${b.booking_request_id}`,
          ctaLabel: CLIENT_DASHBOARD_COPY.quoteCta,
        });
      }
    }
```

Review nudge with inline `StarRating` (dashboard → booking detail with pre-selected stars):

```128:144:frontend/features/client/dashboard/ClientDashboardView.tsx
    for (const b of needsReview.slice(0, 3)) {
      items.push({
        id: `review-${b.booking_request_id}`,
        priority: 3,
        tone: "positive",
        title: `Rate ${b.vendor_display_name}`,
        subtitle: b.event_name,
        href: `/client/bookings/${b.booking_request_id}`,
        trailing: (
          <StarRating
            rating={0}
            size="sm"
            onRate={(value) => router.push(`/client/bookings/${b.booking_request_id}?rate=${value}`)}
          />
        ),
      });
    }
```

Notification dedupe — avoids showing a feed row when the booking already has a live attention item:

```4:12:frontend/features/dashboard/attentionFeedHelpers.ts
export function dashboardNotificationUpdates(
  updates: NotificationFeedItem[],
  coveredBookingIds: ReadonlySet<string>,
): NotificationFeedItem[] {
  return updates.filter((it) => {
    if (!it.unread || it.kind === "chat_unread_summary") return false;
    if (it.booking_id && coveredBookingIds.has(it.booking_id)) return false;
    return true;
  });
}
```

---

## Step 3 — Bookings calendar

`useClientDashboard` builds `bookingsByDate` from **accepted upcoming** bookings, spanning multi-day events (`event_end_date`). `ClientBookingsCalendarCard` highlights days with bookings; clicking a day opens a modal listing bookings on that date.

`upcomingAgenda` — next five accepted bookings sorted by `event_date` — powers the "Your next event" hero with countdown (`daysUntil` / `countdownLabel`).

---

## Step 4 — Generate a celebration plan

**Frontend API:**

```97:102:frontend/lib/clientPlannerApi.ts
export async function createCelebrationPlan(prompt: string): Promise<CelebrationPlanResponse> {
  const { data } = await api.post<CelebrationPlanResponse>("/api/v1/client/planner/plans", {
    prompt,
  });
  return data;
}
```

**Backend route:**

```22:29:backend/app/features/planner/http/routes.py
@router.post("/plans", response_model=CelebrationPlanResponse)
def post_create_plan(
    body: CreateCelebrationPlanRequest,
    request: Request,
    response: Response,
) -> CelebrationPlanResponse:
    user = require_client(request, response)
    return plan_service.generate_plan(str(user.get("id") or ""), body.prompt)
```

`plan_service.generate_plan` pipeline (simplified):

1. `parse_celebration_prompt` → `CelebrationBrief` (event type, location, guests, budget, date)
2. `needs_for_event` → service categories (catering, photography, …)
3. `load_enriched_vendor_pool` + `VendorRankingEngine` → ranked candidates per need
4. `allocate_budget_bands` → estimated costs per line
5. `compute_confidence` → score + reasons
6. Persist to `celebration_plans` table; return `CelebrationPlanResponse`

**URL deep link:** `/client/planner?q=…` auto-submits on mount (`AiPlannerView`). After generate, `router.replace(/client/planner/{planId})` for shareable plan URLs.

---

## Step 5 — Planner → browse / book handoff

Before any enquire, ensure a `client_events` row exists:

```144:150:frontend/lib/clientPlannerApi.ts
/** Create or return the client_events row for this plan (before first booking). */
export async function ensurePlanClientEvent(planId: string): Promise<EnsurePlanEventResponse> {
  const { data } = await api.post<EnsurePlanEventResponse>(
    `/api/v1/client/planner/plans/${encodeURIComponent(planId)}/ensure-event`,
  );
  return data;
}
```

**Backend** — idempotent create-or-return:

```38:75:backend/app/features/planner/event_link.py
def ensure_client_event_for_plan(client_user_id: str, plan_id: str) -> dict[str, Any]:
    """Create or return the client_events row linked to this celebration plan."""
    row = planner_db.get_plan_for_client(plan_id, client_user_id)
    ...
    existing_id = str(row.get("client_event_id") or "").strip()
    if existing_id:
        event_row = client_events_ops.get_client_event_by_id(client_user_id, existing_id)
        if event_row and str(event_row.get("status") or "") == "active":
            return client_events_ops.event_row_to_summary(...)
    ...
    created = client_events_ops.create_client_event(
        client_user_id,
        title=title,
        event_date=event_date,
        event_address=location,
        event_postcode=None,
    )
    ...
    get_db().table("celebration_plans").update(
        {"client_event_id": event_id, "updated_at": datetime.now(timezone.utc).isoformat()},
    ).eq("id", plan_id).eq("client_user_id", client_user_id).execute()
```

**Book now** (single vendor):

```36:40:frontend/features/client/planner/PlannerBookNowButton.tsx
                const ensured = plan.client_event_id
                  ? { event_id: plan.client_event_id }
                  : await ensurePlanClientEvent(plan.plan_id);
                router.push(buildPlannerVendorBookUrl(vendorUserId, plan, ensured.event_id));
```

**Browse all** (multi-vendor selection on marketplace):

```87:101:frontend/features/client/planner/AiPlannerView.tsx
  const handleBrowseHandoff = () => {
    if (!plan) return;
    ...
        const ensured = plan.client_event_id
          ? { event_id: plan.client_event_id }
          : await ensurePlanClientEvent(plan.plan_id);
        ...
        router.push(buildPlannerBrowseUrl(plan, ensured.event_id));
```

`buildPlannerBrowseUrl` passes `linkedEventId`, `fromPlannerPlanId`, event name, venue, and pre-selected vendor IDs into marketplace search state (`plannerModel.ts`).

---

## Step 6 — `client_events` on enquire (Slice 3a glue)

Every booking links to a celebration event. On create, backend resolves or creates the row:

```158:209:backend/app/features/client_events/events.py
def resolve_event_for_booking(
    client_user_id: str,
    *,
    event_id: str | None,
    event_name: str,
    event_date: date,
    ...
) -> tuple[str, dict[str, Any]]:
    """Return (event_id, booking row fields including event_id and denormalized event columns)."""
    if event_id and event_id.strip():
        existing = get_client_event_by_id(client_user_id, event_id.strip())
        ...
        return (str(existing["id"]), { "event_id": ..., "event_name": ..., ... })

    created = create_client_event(client_user_id, title=event_name, event_date=event_date, ...)
    ...
```

**No events page** — clients interact with events indirectly via planner handoff, enquire prefill, and dashboard calendar grouping. `GET /client/events` exists for the prefill hook and future use.

List endpoint:

```22:34:backend/app/features/client_events/http/routes.py
@router.get("/events", response_model=ClientEventsListResponse)
def list_client_events(
    request: Request,
    response: Response,
    status: str = Query("active", description="active, archived, or all"),
) -> ClientEventsListResponse:
    user = require_client(request, response)
    client_id = str(user.get("id") or "")
    ...
    return ClientEventsListResponse(events=[ClientEventSummary(**r) for r in rows])
```

---

## Step 7 — `useActiveEventPrefill` handoff to Slice 3a

**File:** `useActiveEventPrefill.ts` — two modes:

| Mode | Trigger | UX |
|------|---------|-----|
| Linked | `linkedEventId` prop (planner/browse URL) | Silent auto-apply, no banner |
| Banner | No linked ID; active events exist | "Use your celebration" prompt |

Linked mode (planner handoff):

```26:39:frontend/features/bookings/useActiveEventPrefill.ts
  useEffect(() => {
    if (linkedEventId) {
      void fetchClientEventById(linkedEventId)
        .then((event) => {
          if (!event) return;
          const prefill = eventToPrefill(event);
          setLinkedPrefill(prefill);
          setSelectedEventId(prefill.eventId);
          setBannerVisible(false);
        })
        ...
      return;
    }
```

Banner mode (repeat enquire without planner):

```41:51:frontend/features/bookings/useActiveEventPrefill.ts
    if (shouldSkipEventPrefillPrompt()) return;
    void fetchClientEvents("active")
      .then((events) => {
        const primary = pickPrimaryClientEvent(events);
        if (!primary) return;
        setPendingPrefill(eventToPrefill(primary));
        setBannerVisible(true);
      })
```

Primary event selection — most active bookings, then most recently updated:

```64:75:frontend/lib/clientEventsApi.ts
export function pickPrimaryClientEvent(events: ClientEventSummary[]): ClientEventSummary | null {
  const active = events.filter((e) => e.status === "active");
  if (active.length === 0) return null;
  return [...active].sort((a, b) => {
    const ac = b.active_booking_count - a.active_booking_count;
    if (ac !== 0) return ac;
    const bc = b.booking_count - a.booking_count;
    if (bc !== 0) return bc;
    return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
  })[0] ?? null;
}
```

**Slice 3a integration:** `VendorBookingModal` receives `linkedEventId` from browse URL `?event_id=`. See `slice-3a-client-booking-enquire.md` Step 5 for the full prop map.

Dismiss for new event sets `sessionStorage` skip flag via `setSkipEventPrefillForSession(true)`.

---

## Step 8 — Favorites

**Toggle on browse** — `addClientFavorite` / `removeClientFavorite`:

```10:16:frontend/lib/clientFavoritesApi.ts
export async function addClientFavorite(vendorUserId: string): Promise<void> {
  await api.put(`/api/v1/client/favorites/${encodeURIComponent(vendorUserId)}`);
}

export async function removeClientFavorite(vendorUserId: string): Promise<void> {
  await api.delete(`/api/v1/client/favorites/${encodeURIComponent(vendorUserId)}`);
}
```

**Favorites page** reuses marketplace explore with `mode="favorites"` — same cards/filters, filtered to saved vendor IDs. Anonymous hearts are merged on login via `mergeClientFavorites`.

---

## Parameter map — planner handoff

| Step | Client state | API | DB |
|------|--------------|-----|-----|
| Generate plan | `prompt` | `POST /client/planner/plans` | `celebration_plans` row |
| Ensure event | `plan_id` | `POST .../ensure-event` | `client_events` + `celebration_plans.client_event_id` |
| Browse handoff | `linkedEventId` in URL | — | — |
| Enquire | `event_id` on create body | `POST /client/booking-requests` | `booking_requests.event_id` |

---

## Auth summary

| Layer | Guard |
|-------|--------|
| Dashboard, planner, events, favorites | `require_client` |
| Planner generate | Rate-limited dedupe window in `plan_service` (same prompt hash) |

---

## Analytics (Mixpanel)

| Event | When |
|-------|------|
| `client_dashboard_viewed` | First successful dashboard load |
| `dashboard_attention_clicked` | Attention feed CTA clicked |
| `planner_opened` | Planner page mount |
| `planner_plan_viewed` | Browse handoff with `action: browse_handoff` |

---

## When things break

| Symptom | First file to open |
|---------|-------------------|
| Dashboard empty / error | `useClientDashboard.ts` — check `fetchClientBookings` response |
| Attention feed missing quote | `ClientDashboardView` — need `initiator === "vendor"` + `pending` |
| Planner returns no vendors | `explore_vendor_adapter.py` — location/category filters too narrow |
| `ensure-event` 400 | `event_link.py` — plan archived or not found |
| Enquire not pre-filled from planner | Browse URL missing `event_id`; check `PlannerBookNowButton` |
| Banner keeps appearing | `shouldSkipEventPrefillPrompt()` session flag; user dismissed |
| `client_events` 404 on list | Migration `057_client_events.sql` not applied |
| Favorites empty after login | Call `mergeClientFavorites` on auth (marketplace bookmarks hook) |
| Dashboard stale after booking change | SSE not connected — see Slice 7b `useRealtimeSse` |

---

## Improve Eventtz verdict

| Item | Verdict |
|------|---------|
| No `/client/events` page — API-only glue | **Leave it alone** — events are a data model, not a nav destination |
| `ensurePlanClientEvent` before handoff | **Leave it alone** — guarantees shared `event_id` across plan bookings |
| Attention feed priority ordering | **Leave it alone** — quotes beat notifications beat reviews |
| Planner dedupe window | **Leave it alone** — prevents double-submit on slow networks |

---

## Key concepts from this slice

- **Attention feed** — priority-sorted actionable rows, not a raw notification dump.
- **`client_events` glue** — one celebration, many vendor bookings; no dedicated events UI.
- **Planner handoff** — always `ensure-event` → pass `event_id` → `useActiveEventPrefill` silent mode.
- **Primary event pick** — most active bookings wins for banner prefill.
- **Favorites** — persisted vendor IDs; page reuses marketplace explore.
- **SSE refresh** — dashboard reloads on `bookings:refresh` without full page reload (Slice 7b).
- **Bookings list order** — `bookingListOrder.ts` sorts by `updated_at` (Slice 3b cross-ref).
- **Booking ref in header** — `BookingDetailPanel` shows `Ref {shortId(id)}` + copy button (Slice 3b cross-ref).

---

## TL;DR

- **Dashboard** = `/client/dashboard` → attention feed + next event + calendar.
- **Planner** = `/client/planner` → `POST /client/planner/plans` → recommendations + budget.
- **Handoff** = `ensurePlanClientEvent` → `event_id` in browse URL → Slice 3a `linkedEventId`.
- **`client_events`** = groups bookings; created by planner or first enquire.
- **Prefill** = `useActiveEventPrefill` — linked (silent) or banner (primary event).
- **Favorites** = `/client/favorites` via `clientFavoritesApi`.
- **Next:** Slice 7b — realtime SSE, chat, notifications.

---

## Related lessons

- Slice 3a: `slice-3a-client-booking-enquire.md` (`useActiveEventPrefill`, `event_id` on create)
- Slice 3b: `slice-3b-client-booking-detail.md` (`bookingListOrder.ts` recent-first list; `BookingDetailPanel` ref + copy)
- Slice 2: `slice-2-client-browse.md` (marketplace explore, favorites hearts)
- Slice 7b: `slice-7b-comms-realtime.md` (SSE drives dashboard refresh)
