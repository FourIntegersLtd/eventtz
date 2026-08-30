# Prompt: Declutter portal cards (Eventtz → OSCE Guide)

Pass this prompt to an LLM working in **OSCE Guide**. It describes how Eventtz revamped portal/admin UI to remove card clutter — apply the same principles, using OSCE Guide’s existing design tokens (`--brand-primary: #2563eb`, `b2c-*` classes), not Eventtz purple.

---

## Prompt (copy from here)

### Role
Revamp OSCE Guide portal / admin / B2B detail UIs to remove **card clutter**, matching the approach used in Eventtz after its portal declutter pass. Prefer fewer, quieter surfaces; consolidate stacked cards into one divided panel; kill nested “card inside card” chrome.

### Reference (Eventtz — read patterns, don’t copy brand colors)

Repo: `/Users/yahayakenny/Documents/Projects/eventtz`

| Pattern | Path |
|---------|------|
| Portal card tokens | `frontend/components/portal-shell/portalTheme.ts` |
| Admin card token | `frontend/features/admin/adminTheme.ts` (`adminCard`) |
| Shared `Card` component | `frontend/components/ui/Card.tsx` |
| Collapsible inset | `frontend/components/ui/CollapsibleSection.tsx` |
| One-card divided detail | `frontend/features/disputes/ParticipantDisputeDetailPanel.tsx` |
| Admin detail section | `frontend/features/admin/bookings/AdminBookingDetailShared.tsx` (`DetailSection`, `Field`) |
| Docs | `cursor.md` → “Cards / surfaces” |

**Eventtz surface recipe (adapt tokens for OSCE):**
```
rounded-2xl border border-neutral-100 bg-white   // outer card — quiet edge, no shadow/ring
rounded-xl  border border-neutral-100 bg-white   // inset / nested only when needed
p-5 sm:p-6                                       // default padding
```
Prefer **`border`** over **`ring`** / multi-layer **`shadow`** on panels that use `overflow-hidden` (edges get clipped otherwise).

### What “declutter” meant in Eventtz

Surfaces that were cleaned up (same *kind* of work for OSCE):

- Dashboards (client / admin) — fewer KPI tiles; less chrome around charts
- Detail drawers/panels (bookings, disputes, vendors, reviews, audit) — **one card with internal dividers**, not 4–6 stacked cards
- List pages (disputes, reviews) — quieter rows; less badge noise
- Settings — 2-col layout; secondary actions in modals instead of more cards
- Aside / compose / contact / email / payments support panels — single shell, not nested boxes
- Status banners on booking detail — quieter; don’t wrap every alert in a heavy card

### Hard rules (apply everywhere you touch)

**Cards are for interaction containers — not decoration.**

1. **Default: no card.** If removing border/shadow/radius doesn’t hurt understanding or interaction, remove it.
2. **One outer shell per view region.** A detail pane should usually be **one** `rounded-2xl border … bg-white` container. Inside it, use:
   - `divide-y divide-neutral-100` / `border-t`
   - simple `px-5 py-4` sections
   - `dl` / label–value grids (`text-neutral-500` label, `text-neutral-900` value)
   - optional muted band (`bg-neutral-50`) for resolution / notes / secondary info  
   **Not** a new card per field group.
3. **No cards-in-cards.** Never wrap a card inside another card for layout alone. If you need hierarchy, use inset (`rounded-xl` + lighter padding) **or** a collapsible section — not a second full outer card.
4. **One job per section.** One headline, one short supporting line, then content. No duplicate titles in header + card header.
5. **Quiet chrome.** Avoid:
   - Multi-layer shadows, glow, heavy `ring`
   - Pill clusters / badge stacks for non-status metadata
   - Stat strips and icon rows that repeat the same info
   - Colored alert banners wrapping content that already has a status badge
   - Extra “info” callout boxes on top of hero or primary content
6. **Lists:** row = padding + hairline divider (or one shared list card). Don’t put each list item in its own elevated card unless it’s a true interactive tile (e.g. marketplace vendor picker).
7. **Drawers / modals:** one panel surface; actions in a footer strip inside the same shell (`border-t`, soft tint OK). Don’t stack “Summary card”, “Actions card”, “Meta card”.
8. **Mobile:** same one-shell rule; use 1→2 column grids inside the shell (`sm:grid-cols-2`), not more cards.

### Preferred detail-panel pattern (copy this structure)

From Eventtz `ParticipantDisputeDetailPanel` — middle-ground **one divided card**:

```
┌─ rounded-2xl border bg-white ─────────────────┐
│  Header: badges + one-line meta                 │
├─────────────────────────────────────────────────┤
│  Grid of fields (2-col on sm)                   │
├─────────────────────────────────────────────────┤
│  Main body / report text                        │
├─ optional muted band ───────────────────────────┤
│  Notes / resolution                             │
├─ soft action band ──────────────────────────────┤
│  Primary/secondary buttons                      │
└─────────────────────────────────────────────────┘
```

Use hairline `divide-y` / `border-t border-neutral-100`. Status = compact badges, not full-width alert cards.

### Token guidance for OSCE Guide

Map Eventtz tokens → OSCE:

| Eventtz | OSCE Guide |
|---------|------------|
| `portalCard` / `adminCard` | Reuse or introduce one shared string, e.g. `rounded-2xl border border-b2c-border bg-b2c-surface` (or `border-neutral-100` if that matches) |
| `text-neutral-500` labels | `text-b2c-text-secondary` / muted |
| `text-neutral-900` values | `text-b2c-text-primary` |
| `bg-neutral-50` inset band | `bg-b2c-surface-muted` |
| Primary CTA | `--brand-primary` / `b2c-primary` (`#2563eb`) — **not** Eventtz `#3E1964` |

Centralize card class strings (like Eventtz `portalTheme` / `adminTheme`) so features don’t invent ad-hoc `shadow-md rounded-lg border-gray-200` variants.

### Surfaces to audit in OSCE Guide (priority)

Walk these and apply the rules (adjust paths to match the repo):

1. B2C dashboards / home after login  
2. Account settings / profile editors  
3. Marketplace claim / session detail panels  
4. Practice / human-practice detail or report UIs  
5. B2B roster / invite / tenant admin panels  
6. Any admin console tables + detail drawers  
7. Auth adjacent cards only if they’re overly nested (don’t restyle marketing landing unless asked)

For each screen: **count visible card borders**. If a detail view has >2 nested bordered boxes for the same entity, consolidate.

### Process per screen

1. Screenshot / open the page; list every bordered/shadowed box.  
2. Decide the **one** outer shell for that region.  
3. Move content into divided sections / field grids inside it.  
4. Demote nested cards → plain blocks or one `CollapsibleSection`-style inset.  
5. Soften or remove redundant banners when a badge already communicates status.  
6. Keep interaction clear: buttons stay obvious; don’t remove affordances, only chrome.  
7. Verify mobile width — no horizontal overflow from grids.

### Explicit non-goals

- Full visual rebrand of marketing/landing  
- Changing backend APIs or data shape  
- Adding new dashboard widgets / more KPI cards  
- Dark mode  
- Copying Eventtz purple or gold accents  
- “AI SaaS” purple gradients, glow, rounded-full pill spam  

### Acceptance criteria

- [ ] Detail views read as **one composition** (one primary card or panel), not a stack of boxes  
- [ ] No decorative nested cards; inset only when it aids collapse/hierarchy  
- [ ] Shared card class token(s) used instead of one-off shadow recipes  
- [ ] Lists quieter (rows or one list shell)  
- [ ] Status via badges/text, not stacked alert cards  
- [ ] Looks correct on mobile and desktop  
- [ ] Brand accent remains OSCE blue (`#2563eb`), not Eventtz purple  

### Start here

1. Find the noisiest detail panel (settings, session detail, or B2B invite/user drawer).  
2. Refactor it to the **one divided card** pattern above.  
3. Extract shared surface classes if missing.  
4. Apply the same pattern to the next 2–3 high-traffic panels. Prefer small, focused diffs per screen.

---

## End of prompt
