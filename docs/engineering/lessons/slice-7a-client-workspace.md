# Slice 7a — Client workspace (outline)

**Status:** not started — full lesson to be written when this slice is taught.

**Plan:** [FEATURE_TRACK.md § Slice 7a](../FEATURE_TRACK.md#slice-7a--client-workspace)

### User story

A signed-in client uses dashboard, AI planner, linked celebration events, and saved favorites to discover and group bookings.

### Complete route

1. `frontend/app/client/(portal)/dashboard/page.tsx` → `frontend/features/client/dashboard/`
2. `frontend/app/client/(portal)/planner/page.tsx` + `[planId]/page.tsx` → `frontend/features/client/planner/`
3. `frontend/lib/clientPlannerApi.ts`
4. `backend/app/features/planner/http/routes.py` + `plan_service.py`
5. `backend/app/features/client_events/`
6. `frontend/app/client/(portal)/favorites/page.tsx`
7. `backend/app/features/favorites/http/client.py`
8. `frontend/features/bookings/useActiveEventPrefill.ts`

### Key concepts

- `client_events` as glue (no `/client/events` page)
- Planner handoff into enquire (slice 3a)
- Dashboard attention feed
