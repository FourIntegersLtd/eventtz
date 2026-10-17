"use client";

import { CheckCircle2, Clock3, Lock, ShieldCheck } from "lucide-react";
import type { VendorPaymentsStatus } from "@/lib/vendorPaymentsApi";

type PayoutCardState = "not_started" | "in_progress" | "active";

function resolvePayoutCardState(status: VendorPaymentsStatus | null): PayoutCardState {
  if (!status?.stripe_account_id) return "not_started";
  if (status.charges_enabled && status.payouts_enabled) return "active";
  return "in_progress";
}

function maskAccountTail(stripeAccountId: string | null | undefined): string {
  if (!stripeAccountId) return "••••";
  return stripeAccountId.slice(-4).toUpperCase();
}

const STATUS_COPY: Record<
  PayoutCardState,
  { label: string; tone: string; icon: typeof CheckCircle2 }
> = {
  not_started: {
    label: "Not connected",
    tone: "bg-white/15 text-white/90 ring-white/20",
    icon: Lock,
  },
  in_progress: {
    label: "Verification pending",
    tone: "bg-amber-400/20 text-amber-50 ring-amber-200/30",
    icon: Clock3,
  },
  active: {
    label: "Payouts active",
    tone: "bg-emerald-400/20 text-emerald-50 ring-emerald-200/30",
    icon: CheckCircle2,
  },
};

type VendorPayoutCardProps = {
  status: VendorPaymentsStatus | null;
  loading?: boolean;
};

/**
 * Fintech-style payout card — masked bank details, status chip, Stripe branding.
 * We never show real account numbers; Stripe holds payout details after Connect.
 */
export function VendorPayoutCard({ status, loading = false }: VendorPayoutCardProps) {
  const cardState = resolvePayoutCardState(status);
  const meta = STATUS_COPY[cardState];
  const StatusIcon = meta.icon;
  const accountTail = maskAccountTail(status?.stripe_account_id);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-3xl shadow-md shadow-neutral-900/12 ring-1 ring-white/10 transition-opacity ${
        loading ? "opacity-70" : "opacity-100"
      }`}
      aria-hidden={loading}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#2d1247] via-[#3e1964] to-[#6b3fa0]" />
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/10 blur-2xl"/>
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.18)_0%,transparent_42%,rgba(255,255,255,0.06)_100%)]" />

      <div className="relative flex min-h-[240px] flex-col justify-between p-6 sm:min-h-[260px] sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/55">
              Eventtz payouts
            </p>
            <p className="mt-1 font-heading text-lg font-semibold text-white">Business account</p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${meta.tone}`}
          >
            <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {meta.label}
          </span>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Sort code
            </p>
            <p className="mt-1 font-mono text-2xl tracking-[0.2em] text-white/90 blur-[5px] select-none">
              12-34-56
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Account number
            </p>
            <p className="mt-1 font-mono text-2xl tracking-[0.18em] text-white/90 blur-[5px] select-none">
              ••••••{accountTail}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">
              Payout partner
            </p>
            <p className="mt-1 truncate text-sm font-medium text-white/80">Stripe Connect</p>
          </div>
          <div
            className="h-9 w-12 shrink-0 rounded-md bg-gradient-to-br from-amber-100 via-amber-200 to-amber-400 shadow-inner ring-1 ring-white/30"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

type VendorPayoutStepsProps = {
  status: VendorPaymentsStatus | null;
};

const STEPS = [
  {
    key: "connect",
    title: "Link your payout account",
    description: "Secure setup through Stripe, usually 2–3 minutes.",
    done: (s: VendorPaymentsStatus | null) => Boolean(s?.stripe_account_id),
  },
  {
    key: "verify",
    title: "Verify your details",
    description: "Stripe confirms identity and bank information.",
    done: (s: VendorPaymentsStatus | null) =>
      Boolean(s?.stripe_account_id && (s.charges_enabled || s.payouts_enabled)),
  },
  {
    key: "active",
    title: "Receive booking payouts",
    description: "Paid automatically after each completed booking.",
    done: (s: VendorPaymentsStatus | null) =>
      Boolean(s?.charges_enabled && s?.payouts_enabled),
  },
] as const;

export function VendorPayoutSteps({ status }: VendorPayoutStepsProps) {
  return (
    <ol className="space-y-3">
      {STEPS.map((step, index) => {
        const complete = step.done(status);
        const pending =
          !complete &&
          (index === 0 || STEPS[index - 1]?.done(status));
        return (
          <li
            key={step.key}
            className={`flex gap-3 rounded-2xl border px-4 py-3.5 ${
              complete
                ? "border-emerald-200/80 bg-emerald-50/80"
                : pending
                  ? "border-primary-border bg-primary-soft/50"
                  : "border-neutral-200/80 bg-white"
            }`}
          >
            <span
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                complete
                  ? "bg-emerald-600 text-white"
                  : pending
                    ? "bg-primary text-white"
                    : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {complete ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : index + 1}
            </span>
            <div className="min-w-0">
              <p
                className={`text-sm font-semibold ${
                  complete ? "text-emerald-950" : pending ? "text-neutral-900" : "text-neutral-500"
                }`}
              >
                {step.title}
              </p>
              <p
                className={`mt-0.5 text-sm leading-relaxed ${
                  complete ? "text-emerald-900/80" : pending ? "text-neutral-600" : "text-neutral-400"
                }`}
              >
                {step.description}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function VendorPayoutSecurityNote() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 px-4 py-3.5">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
      <p className="text-sm leading-relaxed text-neutral-600">
        Bank details are stored and verified by Stripe. Eventtz never sees your full account
        number, only whether payouts are ready.
      </p>
    </div>
  );
}
