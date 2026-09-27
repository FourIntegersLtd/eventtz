/** Icon and Lottie presets for empty states, chosen by what is missing. */

import type { LucideIcon } from "lucide-react";
import { CalendarDays, Heart, LifeBuoy, MessageSquare, Users } from "lucide-react";
import type { EmptyLottieAssetKey } from "@/foundation/ui/lottieAssets";

/** Semantic empty-state visuals - pick by context, not a generic mail envelope. */
export type EmptyStateVariant =
  | "favorites"
  | "bookings"
  | "payments"
  | "vendors"
  | "messages"
  | "support"
  | "team";

type EmptyStateVariantConfig = {
  lottie?: EmptyLottieAssetKey;
  icon?: LucideIcon;
};

/** Size and colour for a lucide icon used as an empty-state mark. */
export const EMPTY_STATE_ICON_CLASS = "h-12 w-12 text-neutral-300";

/** Which illustration each empty-state context uses. */
export const EMPTY_STATE_VARIANTS: Record<EmptyStateVariant, EmptyStateVariantConfig> = {
  favorites: { icon: Heart },
  bookings: { icon: CalendarDays },
  payments: { lottie: "paymentSecure" },
  vendors: { lottie: "searchNoResults" },
  messages: { icon: MessageSquare },
  support: { icon: LifeBuoy },
  team: { icon: Users },
};
