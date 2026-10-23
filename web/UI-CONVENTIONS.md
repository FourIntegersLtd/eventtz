# Frontend UI conventions

Moved from the old architecture reference. Paths refer to the pre-rebuild layout
(`components/ui`, `lib/`, `features/`); they move to `foundation/ui` during Phase 3.

### Shared primitives, not hand-rolled classes

Use `Card`, `Button`, `Badge` and `Banner` from `components/ui` instead of writing card, button, pill or
alert classes by hand. Colour comes from the semantic tokens (`TONE`: neutral, brand, success, warning,
danger, info); brand purple is for the main action only. Weights stop at 600, controls and labels use 500,
inputs 400. `/internal/ui-kit` shows every primitive in every state.

### Action feedback (mutations)

After a button click or form submit, the user must see **success or failure** within about a second unless the UI change is obviously immediate (e.g. chat bubble appears).

| Situation | Success | Failure |
|-----------|---------|---------|
| **Mutation** (save, send, approve, toggle, delete) | `useToast().showToast({ tone: "success", ... })` | `showToast({ tone: "error", ... })` and/or inline / `AdminErrorBanner` / `LottieFailureInline` |
| **Form validation** | N/A | Inline field error or `LottieFailureInline` |
| **Destructive / money-moving** | Toast plus existing confirm/result modal where present | Modal or toast + inline |
| **Implicit OK** (chat bubble, status badge refresh) | Optional toast for high-stakes actions; failures always surface | Always surface failures |
| **Background / best-effort** (mark notifications read on open) | Silent OK | Silent OK |

Helper: **`lib/mutationFeedback.ts`** (`withMutationFeedback`, `mutationErrorMessage`). Admin persistent success: **`AdminSuccessBanner`**.

**Intentionally implicit (do not add toasts):** chat send (bubble appears), admin inbox reply append, blog `savedHint` inline text.

### Mobile responsiveness

- **Touch targets:** use **`TOUCH_TARGET`** (`min-h-11 min-w-11`) from **`components/ui/tokens.ts`** for icon buttons and primary taps.
- **Motion & Lottie (decision guide for new engineers):**

  | Need | Use |
  |------|-----|
  | Modal / drawer open-close | **`Modal`** / **`Drawer`** only - do **not** wrap content in extra `motion.*` |
  | List/grid entrance | **`MotionStaggerItem`** (`stagger={false}` for chat bubbles) |
  | Landing scroll reveal | **`MotionReveal`** |
  | Empty list / no results | **`EmptyState`** or **`LottieEmptyPanel`** with **`variant`** (`favorites`, `bookings`, `payments`, `vendors`, `messages`, `support`, `team`) - see **`lib/emptyStateVariants.ts`** |
  | Page/panel loading | **`LoadingState`** `branded` or `lottie` |
  | High-stakes confirm | **`ConfirmDialog`** `lottie` prop |
  | Full-page / section error | **`LottieFailurePanel`** |
  | Compact form/fetch error | **`LottieFailureInline`** - never hand-roll `border-red-200` + Lottie |
  | One-off illustration | **`LottieIllustration`** `asset={…}` - size via `className` only (omit to get default) |
  | Onboarding (client/vendor) | Bookends only: **`welcome`** Lottie on first screen, milestone Lottie on finish/submitted; step body uses **`animate-onboarding-panel`** + **`AnimatedStepItem`** stagger. Do **not** put Lottie on every form field |

  **Never** use the **`loading`** asset on empty states - it is a spinner loop and reads as “still loading” next to “no results” copy. **Never** use **`emptyInbox`** / **`emptyMessages`** (mail envelope) as a generic empty illustration - those keys are deprecated; pick a semantic **`variant`** or **`searchNoResults`** for filter misses.

  Asset paths live **only** in **`lib/lottieAssets.ts`**. Prefer shared UI primitives over importing **`motion/react`** in feature folders (allowed only inside `components/ui/*`). Respect **`usePrefersReducedMotion`** (primitives already do).
- **Viewport height:** prefer **`VIEWPORT_MIN`** (`min-h-dvh`) over `min-h-screen` on full-page shells (mobile browser chrome). Marketing landing sections use **`landingSectionClass(..., { shell })`** in **`features/landing/landingSectionStyles.ts`**: **`full`** (hero - `min-h-dvh`), **`near`** (story CTAs - `lg:min-h-dvh`), **`content`** (discover, grids, FAQ - padding only). Prefer `min-h-dvh` over `h-dvh` so tall content can grow.
- **Modals:** use **`MODAL_PANEL`** from tokens; body scroll via **`max-h-[min(70dvh,640px)] overflow-y-auto`** in **`Modal.tsx`**.
- **Flex rows:** add **`min-w-0`** on text children and **`flex-wrap`** on toolbars/filter bars so narrow phones do not overflow.
- **Grids:** default to **`grid-cols-1`** on xs; step up at **`sm:`** / **`md:`**. Admin tables may use **`overflow-x-auto`** or card fallback below **`md`**.
- **Horizontal scrollbars (mobile):** below **`md`**, **`globals.css`** hides horizontal scrollbar tracks app-wide (landing, auth, client/vendor portal, admin). Use **`overflow-x-auto`** when content must scroll sideways; touch/swipe still works - do not add per-component scrollbar-hiding unless you need desktop-only behaviour.
- **Master-detail:** **`MasterDetailLayout`** - one pane at a time below **`lg`** (used by chat only).

Feature-local **constants, labels, formatters** stay under that feature unless reused across 2+ domains (then consider `lib/`).

Cross-feature data that is not an HTTP client may live next to its owner (e.g. **`browseLabels.ts`** under **`features/client/browse/`**).

---

