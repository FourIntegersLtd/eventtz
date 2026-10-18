"use client";

import { ChevronRight, Flag, MapPin } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { RegisterAccountType } from "@/features/auth/useUnifiedRegister";

/** One stop on the route between registering and the destination. */
type RouteStop = {
  title: string;
  detail: string;
  /** Label under the marker in the compact mobile strip, where space is tight. */
  shortTitle?: string;
  optional?: boolean;
};

/** The journey copy for each account type, shown with the register form. */
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
      { title: "Get requests", shortTitle: "Requests", detail: "Clients pick a package, date and venue" },
      { title: "Agree", detail: "Chat to refine any details", optional: true },
    ],
    destination: { title: "Get paid", detail: "Accept, the client pays, payout after the event" },
  },
};

/** Dashed connector drawn between two markers in the vertical list. */
function Connector({ onBrand = false }: { onBrand?: boolean }) {
  const lineColor = onBrand ? "border-white/40" : "border-primary/40";
  return <span className={`mx-auto block h-8 w-0 border-l-2 border-dashed ${lineColor}`} aria-hidden />;
}

/** "You are here" marker: a filled pin inside a soft halo. */
function CurrentMarker({ size, onBrand = false }: { size: "sm" | "lg"; onBrand?: boolean }) {
  const outer = size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const inner = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  return (
    <span className={`relative flex ${outer} items-center justify-center rounded-full ${onBrand ? "bg-white/15" : "bg-primary/15"}`}>
      <span className={`flex ${inner} items-center justify-center rounded-full ${onBrand ? "bg-white text-primary" : "bg-primary text-white"}`}>
        <MapPin className="h-4 w-4" aria-hidden />
      </span>
    </span>
  );
}

/** Numbered marker for a stop between registering and the destination. */
function StepMarker({ number, onBrand = false }: { number: number; onBrand?: boolean }) {
  return (
    <span className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 ${onBrand ? "border-white/60 bg-transparent text-white" : "border-primary/50 bg-white text-primary"}`}>
      {number}
    </span>
  );
}

/** Filled flag marker for the destination. */
function DestinationMarker({ size, onBrand = false }: { size: "sm" | "lg"; onBrand?: boolean }) {
  const dimensions = size === "lg" ? "h-12 w-12" : "h-11 w-11";
  return (
    <span className={`relative flex ${dimensions} items-center justify-center rounded-full ${onBrand ? "bg-white text-primary" : "bg-primary text-white"}`}>
      <Flag className="h-5 w-5" aria-hidden />
    </span>
  );
}

type StepLabelProps = {
  /** `solid` filled pill, `muted` quiet pill, `plain` bare uppercase text. */
  look: "solid" | "muted" | "plain";
  onBrand: boolean;
  children: ReactNode;
};

/** Small uppercase label used beside the route stops ("You are here", "Optional", "Destination"). */
function StepLabel({ look, onBrand, children }: StepLabelProps) {
  const looks = {
    solid: onBrand ? "bg-white text-primary" : "bg-primary text-white",
    muted: onBrand ? "bg-white/15 text-white/80" : "bg-surface-3 text-ink-3",
    plain: onBrand ? "text-white/80" : "text-primary",
  };
  const shape = look === "plain" ? "" : "rounded-full px-2.5 py-0.5";
  return (
    <span className={`inline-block text-[11px] font-semibold uppercase tracking-wide ${shape} ${looks[look]}`.replace(/\s+/g, " ")}>
      {children}
    </span>
  );
}

/** The vertical, fully described list of stops (desktop panel and mobile "See how it works"). */
function RouteSteps({ route, onBrand = false }: { route: RouteCopy; onBrand?: boolean }) {
  const titleColor = onBrand ? "text-white" : "text-ink";
  const detailColor = onBrand ? "text-white/75" : "text-ink-2";
  return (
    <ol>
      <li className="flex gap-5">
        <div className="relative flex w-14 shrink-0 flex-col items-center">
          <CurrentMarker size="lg" onBrand={onBrand} />
          <Connector onBrand={onBrand} />
        </div>
        <div className="pt-1">
          <StepLabel look="solid" onBrand={onBrand}>
            You are here
          </StepLabel>
          <p className={`mt-1 text-lg font-semibold ${titleColor}`}>Register</p>
        </div>
      </li>

      {route.stops.map((stop, stopIndex) => (
        <li key={stop.title} className="flex gap-5">
          <div className="flex w-14 shrink-0 flex-col items-center">
            <StepMarker number={stopIndex + 1} onBrand={onBrand} />
            <Connector onBrand={onBrand} />
          </div>
          <div>
            <p className={`flex items-center gap-2 text-lg font-semibold ${titleColor}`}>
              {stop.title}
              {stop.optional ? (
                <StepLabel look="muted" onBrand={onBrand}>
                  Optional
                </StepLabel>
              ) : null}
            </p>
            <p className={`text-sm ${detailColor}`}>{stop.detail}</p>
          </div>
        </li>
      ))}

      <li className="flex gap-5">
        <div className="flex w-14 shrink-0 justify-center">
          <DestinationMarker size="lg" onBrand={onBrand} />
        </div>
        <div>
          <StepLabel look="plain" onBrand={onBrand}>
            Destination
          </StepLabel>
          <p className={`text-lg font-semibold ${titleColor}`}>{route.destination.title}</p>
          <p className={`text-sm ${detailColor}`}>{route.destination.detail}</p>
        </div>
      </li>
    </ol>
  );
}

type RegisterRouteProps = { accountType: RegisterAccountType; className?: string };

/**
 * Step-by-step "route" from registering to a confirmed booking, worded for the
 * chosen account type. Shown on the brand panel on desktop.
 */
export function RegisterRoute({ accountType, className = "" }: RegisterRouteProps) {
  const route = ROUTES[accountType];
  return (
    <section aria-label={route.eyebrow} className={`w-full max-w-md text-white ${className}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">{route.eyebrow}</p>
      <h2 className="mt-2 font-heading text-2xl font-semibold text-white">{route.heading}</h2>
      <div className="mt-6">
        <RouteSteps route={route} onBrand />
      </div>
    </section>
  );
}

/**
 * Mobile version of the route: one horizontal strip of markers inside the form
 * card, with "See how it works" expanding the full described list.
 */
export function RegisterRouteCompact({ accountType, className = "" }: RegisterRouteProps) {
  const [expanded, setExpanded] = useState(false);
  const route = ROUTES[accountType];
  // Five equal columns put marker centres at 10% and 90%, so the line runs between them.
  return (
    <section aria-label={route.eyebrow} className={`rounded-2xl bg-primary/5 px-3 py-4 ${className}`.trim()}>
      <ol className="relative flex">
        <span
          className="absolute left-[10%] right-[10%] top-[22px] border-t-2 border-dashed border-primary/40"
          aria-hidden
        />
        <li className="flex flex-1 flex-col items-center text-center">
          <CurrentMarker size="sm" />
          <span className="mt-1.5 text-xs font-semibold leading-tight text-primary">
            You are
            <br />
            here
          </span>
        </li>
        {route.stops.map((stop, stopIndex) => (
          <li key={stop.title} className="flex flex-1 flex-col items-center text-center">
            <span className="flex h-11 items-center">
              <StepMarker number={stopIndex + 1} />
            </span>
            <span className="mt-1.5 text-xs font-medium leading-tight text-ink-2">
              {stop.shortTitle ?? stop.title}
            </span>
          </li>
        ))}
        <li className="flex flex-1 flex-col items-center text-center">
          <DestinationMarker size="sm" />
          <span className="mt-1.5 text-xs font-semibold leading-tight text-primary">
            {route.destination.shortTitle ?? route.destination.title}
          </span>
        </li>
      </ol>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
        className="mx-auto mt-4 flex min-h-11 items-center gap-1 text-sm font-semibold text-primary"
      >
        {expanded ? "Hide how it works" : "See how it works"}
        <ChevronRight
          className={`h-4 w-4 transition-transform motion-reduce:transition-none ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        />
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-primary/10 px-1 pt-4">
          <p className="mb-4 font-heading text-lg font-semibold text-ink">{route.heading}</p>
          <RouteSteps route={route} />
        </div>
      ) : null}
    </section>
  );
}
