import { MIN_PORTFOLIO_IMAGES } from "../../../lib/vendorOnboarding/constants";
import { ONBOARDING_FORM_STEP_COUNT } from "../../../lib/vendorOnboarding/onboardingProgress";
import { packageExamplesForServices } from "../../../lib/vendorOnboarding/packageExamples";
import { vendorServiceOnboardingGuideSections } from "@/lib/vendorServiceCatalog";

export type OnboardingStepGuide = {
  title: string;
  sections: Array<{ heading?: string; body: string }>;
};

export function getOnboardingStepGuide(
  step: number,
  servicesOffered: string[] = [],
): OnboardingStepGuide | null {
  if (step < 1 || step > ONBOARDING_FORM_STEP_COUNT) return null;

  switch (step) {
    case 1:
      return {
        title: "Your contact details",
        sections: [
          {
            body: "Clients see your name and phone after they book. We use your email for login and important booking updates.",
          },
        ],
      };
    case 2:
      return {
        title: "Your business & services",
        sections: [
          {
            heading: "Business name",
            body: "Must be unique on Eventtz. This is how clients find and remember you.",
          },
          {
            heading: "Services & events",
            body: "Pick the main service you offer and the event types you work on. This helps us show relevant examples when you add packages.",
          },
          ...vendorServiceOnboardingGuideSections(),
        ],
      };
    case 3:
      return {
        title: "Location & travel",
        sections: [
          {
            body: "Your base city helps clients find you. Travel and delivery rules affect how you charge for distance. You can apply the default rule to each package on the Pricing step.",
          },
        ],
      };
    case 4: {
      const examples = packageExamplesForServices(servicesOffered);
      return {
        title: "What is an item / package?",
        sections: [
          {
            body: "An item / package is something a customer can choose and book from you, not your whole business. It can be a bundle (a full decor set-up) or a single item (chair hire, one cake). Each needs a clear name, a price, and a description of exactly what's included.",
          },
          {
            heading: "Good rule",
            body: "A client should understand what they're buying without messaging you for basic details.",
          },
          {
            heading: `Example (${examples.label})`,
            body: examples.examples
              .map((ex) => `${ex.name} – ${ex.price}\n${ex.included}`)
              .join("\n\n"),
          },
          {
            heading: "Rates vs packages",
            body: "Hourly or daily rates are optional. For catering, cakes, makeup, hair styling, decor, and event planning we require at least one complete package.",
          },
        ],
      };
    }
    case 5:
      return {
        title: "Cancellation policy",
        sections: [
          {
            body: "Pick how much of your price a client gets back if they cancel after paying. The Eventtz service fee is always refunded. Until you choose, clients see Flexible.",
          },
        ],
      };
    case 6:
      return {
        title: "Availability",
        sections: [
          {
            body: "Choose the days you take bookings and how many events you can handle per day. Clients only see dates you mark as available.",
          },
        ],
      };
    case 7:
      return {
        title: "Portfolio photos",
        sections: [
          {
            body: `Upload at least ${MIN_PORTFOLIO_IMAGES} photos that match what you offer. If you list multiple packages, show variety so clients can see each style of work.`,
          },
        ],
      };
    case 8:
      return {
        title: "Additional information",
        sections: [
          {
            body: "Certificates and allergen info help build trust, especially for food vendors. Everything here is optional but recommended where it applies.",
          },
        ],
      };
    case 9:
      return {
        title: "Before you submit",
        sections: [
          {
            body: "We review every profile before it goes live. Check that each package has a name, price, and a clear “what's included” description. Add a profile photo if you haven't already.",
          },
          {
            body: "Use “Help me improve my packages” on the Pricing step for AI suggestions. They won't block you from submitting.",
          },
        ],
      };
    default:
      return null;
  }
}

export const PRICING_INFO_SEEN_KEY = "eventtz-onboarding-info-seen-pricing";
