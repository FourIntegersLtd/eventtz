/**
 * Leftover portal surface strings, kept only for `BookingDetailPanel` and the help views, which
 * another PR is rewriting. Use `CARD_SURFACE` / `CARD_PADDING` from `components/ui/tokens` and
 * delete this file once those imports are gone.
 */

import { CARD_PADDING, CARD_SURFACE } from "@/components/ui/tokens";

/** Standard portal card surface. */
export const portalCard = CARD_SURFACE;

/** Default section padding inside portal cards. */
export const portalCardPadding = CARD_PADDING;

/** Full-height master-detail panel shell (bookings, messages). */
export const portalPanelShell = `flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden ${CARD_SURFACE} ${CARD_PADDING}`;
