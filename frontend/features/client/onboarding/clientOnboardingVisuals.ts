import {
  CalendarHeart,
  MessageCircle,
  PartyPopper,
  Scale,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ClientOnboardingStep } from "@/features/client/onboarding/clientOnboardingCopy";

export type OnboardingIconVisual = {
  Icon: LucideIcon;
  shell: string;
  icon: string;
};

/** Soft icon tiles aligned with app tokens (primary, primary-soft, accent-violet). */
export const CLIENT_ONBOARDING_ICON_VISUALS: Record<
  Exclude<ClientOnboardingStep, "welcome" | "name" | "finish">,
  OnboardingIconVisual
> = {
  browse: {
    Icon: Search,
    shell: "bg-primary-soft ring-1 ring-primary-border/60",
    icon: "text-primary",
  },
  book: {
    Icon: CalendarHeart,
    shell: "bg-primary-muted ring-1 ring-primary-border/60",
    icon: "text-primary",
  },
  payments: {
    Icon: ShieldCheck,
    shell: "bg-primary-soft ring-1 ring-primary-border/60",
    icon: "text-accent-violet",
  },
  messages: {
    Icon: MessageCircle,
    shell: "bg-primary-muted ring-1 ring-primary-border/60",
    icon: "text-primary",
  },
  disputes: {
    Icon: Scale,
    shell: "bg-primary-soft ring-1 ring-primary-border/60",
    icon: "text-accent-violet",
  },
};

export const CLIENT_ONBOARDING_WELCOME_ICON: OnboardingIconVisual = {
  Icon: Sparkles,
  shell: "bg-white ring-1 ring-primary-border/70",
  icon: "text-primary",
};

export const CLIENT_ONBOARDING_NAME_ICON: OnboardingIconVisual = {
  Icon: UserRound,
  shell: "bg-primary-soft ring-1 ring-primary-border/60",
  icon: "text-primary",
};

export const CLIENT_ONBOARDING_FINISH_ICON: OnboardingIconVisual = {
  Icon: PartyPopper,
  shell: "bg-primary-muted ring-1 ring-primary-border/60",
  icon: "text-primary",
};

export const CLIENT_ONBOARDING_FINISH_CHIPS = [
  { visual: CLIENT_ONBOARDING_ICON_VISUALS.browse, label: "Browse vendors" },
  { visual: CLIENT_ONBOARDING_ICON_VISUALS.book, label: "Book & pay" },
  { visual: CLIENT_ONBOARDING_ICON_VISUALS.messages, label: "Message" },
  { visual: CLIENT_ONBOARDING_ICON_VISUALS.disputes, label: "Disputes" },
] as const;
