import { SHADOW } from "@/components/ui/tokens";

/**
 * Shared Tailwind class strings for client/vendor portal UI.
 * Mirror of `features/admin/adminTheme.ts` — use these instead of copying card shells.
 */

/** Standard portal card surface (settings sections, dashboard tiles, list panels). */
export const portalCard = `rounded-2xl bg-white ${SHADOW.resting} ring-1 ring-neutral-200/50`;

/** Default section padding inside portal cards. */
export const portalCardPadding = "p-5 sm:p-6";

/** Larger padding for auth forms and booking detail panels. */
export const portalCardPaddingLg = "p-6 sm:p-8";

/** Full-height master-detail panel shell (bookings, messages). */
export const portalPanelShell = `flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden ${portalCard} ${portalCardPadding}`;

/** Nested / collapsible sections — slightly smaller radius, border instead of ring. */
export const portalInsetCard = "rounded-xl border border-neutral-200/90 bg-white shadow-sm";

/** Page background — matches `--page-bg` in globals.css. */
export const portalPageBg = "bg-page-bg";

/** Auth/marketing shell background — matches `--auth-bg` in globals.css. */
export const authPageBg = "bg-auth-bg";

/** Soft branded gradient used on sign-in/register shells. */
export const authPageGradient =
  "bg-gradient-to-br from-auth-bg via-primary-muted/40 to-primary-soft";
