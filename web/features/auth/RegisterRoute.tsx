import { Flag, MapPin } from "lucide-react";
import type { RegisterAccountType } from "@/features/auth/useUnifiedRegister";

/** One stop on the route between registering and the destination. */
type RouteStop = { title: string; detail: string; optional?: boolean };

/** The journey copy for each account type, shown beside the register form. */
type RouteCopy = {
  eyebrow: string;
  heading: string;
  stops: RouteStop[];
  destination: RouteStop;
};

const ROUTES: Record<RegisterAccountType, RouteCopy> = {
  client: {
    eyebrow: "Your route as a client",
    heading: "Book a vendor without a single DM",
    stops: [
      { title: "Browse", detail: "See prices and availability" },
      { title: "Request", detail: "Pick a package, date and venue" },
      { title: "Agree", detail: "Chat to refine any details", optional: true },
    ],
    destination: { title: "Confirm", detail: "Vendor accepts, then you pay" },
  },
  vendor: {
    eyebrow: "Your route as a vendor",
    heading: "Get booked without chasing a single DM",
    stops: [
      { title: "Set up", detail: "Add your packages, prices and availability" },
      { title: "Get requests", detail: "Clients pick a package, date and venue" },
      { title: "Agree", detail: "Chat to refine any details", optional: true },
    ],
    destination: { title: "Get paid", detail: "Accept, the client pays, payout after the event" },
  },
};

/** Dashed connector drawn between two route markers. */
function Connector() {
  return <span className="mx-auto block h-8 w-0 border-l-2 border-dashed border-primary/40" aria-hidden />;
}

/**
 * Step-by-step "route" from registering to a confirmed booking, worded for the
 * chosen account type. Sits beside the form on desktop and below it on mobile.
 */
export function RegisterRoute({ accountType }: { accountType: RegisterAccountType }) {
  const route = ROUTES[accountType];
  return (
    <section aria-label={route.eyebrow} className="w-full max-w-md lg:max-w-lg">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{route.eyebrow}</p>
      <h2 className="mt-2 font-heading text-2xl font-semibold text-neutral-900 sm:text-3xl">{route.heading}</h2>

      <ol className="mt-8">
        <li className="flex gap-5">
          <div className="relative flex w-14 shrink-0 flex-col">
            <span
              className="absolute right-full top-7 mr-3 hidden w-8 border-t-2 border-dashed border-primary/50 lg:block"
              aria-hidden
            />
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                <MapPin className="h-5 w-5" aria-hidden />
              </span>
            </span>
            <Connector />
          </div>
          <div className="pt-1">
            <span className="inline-block rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
              You are here
            </span>
            <p className="mt-1 text-lg font-semibold text-neutral-900">Register</p>
          </div>
        </li>

        {route.stops.map((stop, stopIndex) => (
          <li key={stop.title} className="flex gap-5">
            <div className="flex w-14 shrink-0 flex-col">
              <span className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary/50 bg-white text-sm font-semibold text-primary">
                {stopIndex + 1}
              </span>
              <Connector />
            </div>
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold text-neutral-900">
                {stop.title}
                {stop.optional ? (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                    Optional
                  </span>
                ) : null}
              </p>
              <p className="text-sm text-neutral-600">{stop.detail}</p>
            </div>
          </li>
        ))}

        <li className="flex gap-5">
          <div className="flex w-14 shrink-0 justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white">
              <Flag className="h-5 w-5" aria-hidden />
            </span>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">Destination</p>
            <p className="text-lg font-semibold text-neutral-900">{route.destination.title}</p>
            <p className="text-sm text-neutral-600">{route.destination.detail}</p>
          </div>
        </li>
      </ol>
    </section>
  );
}
