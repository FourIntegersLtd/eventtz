import type { ReactNode } from "react";

const mockShellClass = "space-y-4 p-4 sm:p-5";

const mockNeutralCardClass = "rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5";
const mockAccentCardClass = "rounded-2xl border border-primary-border/60 bg-primary-soft/30 p-4 sm:p-5";

const mockLabelNeutralClass =
  "text-xs font-semibold uppercase tracking-wide text-neutral-500";
const mockLabelAccentClass = "text-xs font-medium text-primary";

const mockTitleClass = "font-heading mt-1 text-base font-semibold text-neutral-900";
const mockMetaClass = "mt-1 text-sm text-neutral-600";
const mockDetailClass = "mt-2 text-sm text-neutral-700";

type PathMockCardProps = {
  label: string;
  title: string;
  meta?: string;
  detail?: ReactNode;
};

function PathMockNeutralCard({ label, title, meta, detail }: PathMockCardProps) {
  return (
    <div className={mockNeutralCardClass}>
      <p className={mockLabelNeutralClass}>{label}</p>
      <p className={mockTitleClass}>{title}</p>
      {meta ? <p className={mockMetaClass}>{meta}</p> : null}
      {detail ? <p className={mockDetailClass}>{detail}</p> : null}
    </div>
  );
}

function PathMockAccentCard({ label, title, meta, detail }: PathMockCardProps) {
  return (
    <div className={mockAccentCardClass}>
      <p className={mockLabelAccentClass}>{label}</p>
      <p className={mockTitleClass}>{title}</p>
      {meta ? <p className={mockMetaClass}>{meta}</p> : null}
      {detail ? <p className={mockDetailClass}>{detail}</p> : null}
    </div>
  );
}

function PathMockPanel({ children }: { children: ReactNode }) {
  return <div className={mockShellClass}>{children}</div>;
}

/** Client journey: browse packages, then track your request. */
export function ClientDashboardMock() {
  return (
    <PathMockPanel>
      <PathMockNeutralCard
        label="Browse"
        title="Golden Plates Catering"
        detail={
          <>
            Gold package · <span className="font-semibold text-primary">GBP 450</span>
          </>
        }
      />
      <PathMockAccentCard
        label="Your request"
        title="Summer wedding"
        meta="12 Aug · London"
        detail="Agree the details in chat, then pay once the vendor confirms."
      />
    </PathMockPanel>
  );
}

/** Vendor journey: review a request, then mark complete for payout. */
export function VendorDashboardMock() {
  return (
    <PathMockPanel>
      <PathMockNeutralCard
        label="New booking"
        title="Summer wedding"
        meta="12 Aug · London"
        detail={
          <>
            Gold package · <span className="font-semibold text-primary">GBP 450</span>
          </>
        }
      />
      <PathMockAccentCard
        label="Complete"
        title="Event complete?"
        detail="Confirm it went well and get paid when the event is done."
      />
    </PathMockPanel>
  );
}
