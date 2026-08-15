# `frontend/components/` — shared UI and shells

Reusable UI and cross-cutting chrome only. **Product screens and domain widgets live in [`features/`](../features/)**; routes live in [`app/`](../app/README.md).

## Folder map

| Folder | Purpose |
|--------|---------|
| [`ui/`](ui/) | Generic primitives — Button, Modal, inputs, loading, motion, layout tokens |
| [`badges/`](badges/) | Domain-labeled status badges (booking, payment, vendor, dispute, admin) |
| [`auth/`](auth/) | `AuthProvider`, `Require*`, auth page shell |
| [`portal-shell/`](portal-shell/) | Client + vendor portal chrome (`PortalShell`, nav, theme, `PortalFillHeight`) |
| [`admin-shell/`](admin-shell/) | Admin console chrome (`AdminShell`, `adminTheme`) |
| [`branding/`](branding/) | Logo and brand marks |
| [`compliances/`](compliances/) | Legal page shell + static policy content |
| [`media/`](media/) | Landing media wrappers |
| [`analytics/`](analytics/) | Mixpanel page-view tracking |

## Dependency rules

```text
app/        → features/, components/
features/   → components/, lib/
components/ → lib/ only   (never import from features/)
lib/        → lib/ only   (never import from features/ or components/)
```

**Product UI belongs in `features/`**, e.g. shared vendor listing presentation in [`features/vendors/display/`](../features/vendors/display/) (browse cards, portfolio gallery, pricing blocks).

## Shell wiring

| Portal | Shell | Where mounted |
|--------|-------|---------------|
| Client | `PortalShell` (`portal="client"`) | [`app/client/(portal)/layout.tsx`](../app/client/(portal)/layout.tsx) |
| Vendor | `PortalShell` (`portal="vendor"`) | [`app/vendor/(portal)/layout.tsx`](../app/vendor/(portal)/layout.tsx) |
| Admin | `AdminShell` via `AdminConsolePage` | Each [`app/admin/(portal)/`](../app/admin/(portal)/) page |

Shells may compose feature widgets (e.g. `HelpWidget`, notification bell) — that is intentional cross-cutting chrome, not product logic.

## Theme tokens

- Portal cards/surfaces: [`portal-shell/portalTheme.ts`](portal-shell/portalTheme.ts)
- Admin cards/surfaces: [`admin-shell/adminTheme.ts`](admin-shell/adminTheme.ts)

Both build on shared surfaces in [`ui/sectionBlockTokens.ts`](ui/sectionBlockTokens.ts).

## Adding a new component

1. **Generic control** (no domain names) → `ui/`
2. **Domain status label** (used across portals) → `badges/`
3. **Portal or admin chrome** → `portal-shell/` or `admin-shell/`
4. **Single-feature widget** → `features/<domain>/`, not here

See [`cursor.md`](../../cursor.md) for full frontend layering.
