"use client";

import { useState } from "react";
import { AlertTriangle, Inbox, Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/badges/StatusBadge";
import { ParticipantDisputeStatusBadge } from "@/components/badges/ParticipantDisputeStatusBadge";
import { PaymentStatusBadge } from "@/components/badges/PaymentStatusBadge";
import { VendorApprovalStatusBadge } from "@/components/badges/VendorApprovalStatusBadge";
import { VendorProfileStatusBadge } from "@/components/badges/VendorProfileStatusBadge";
import { AccountStatusBadge } from "@/components/badges/AccountStatusBadge";
import { ReviewVisibilityBadge } from "@/components/badges/ReviewVisibilityBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { LoadingState } from "@/components/ui/LoadingState";
import { Skeleton, SkeletonListRows, SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Avatar } from "@/components/ui/Avatar";
import { BackLink } from "@/components/ui/BackLink";
import { Badge } from "@/components/ui/Badge";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DateInput } from "@/components/ui/DateInput";
import { DescriptionList } from "@/components/ui/DescriptionList";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PasswordField } from "@/components/ui/PasswordField";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { StatTile } from "@/components/ui/StatTile";
import { Stepper } from "@/components/ui/Stepper";
import { Tabs } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Tone } from "@/lib/tone";

const ALL_TONES: readonly Tone[] = ["neutral", "brand", "success", "warning", "danger", "info"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-line pb-10">
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** Dev-only preview of `components/ui` primitives. Not linked from nav. */
export function UiKitView() {
  const [segment, setSegment] = useState<"needsAction" | "upcoming" | "completed">("needsAction");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [tab, setTab] = useState<"all" | "active" | "closed">("all");
  const [chipActive, setChipActive] = useState(true);
  const { showToast } = useToast();

  if (process.env.NODE_ENV === "production") {
    return (
      <main className="min-h-dvh px-6 py-16 text-center text-sm text-ink-3">
        Not available in production.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <h1 className="font-heading text-2xl font-semibold text-ink">UI kit preview</h1>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button shape="pill">Pill</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-primary p-4">
          <Button variant="inverted">Inverted</Button>
          <Button variant="invertedOutline">Inverted outline</Button>
        </div>
      </Section>

      <Section title="Badge and status badges">
        <div className="flex flex-wrap items-center gap-2">
          {ALL_TONES.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Booking</p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="pending" />
              <StatusBadge status="accepted" />
              <StatusBadge status="completed" />
              <StatusBadge status="declined" />
              <StatusBadge status="cancelled" />
              <StatusBadge status="disputed" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Payment</p>
            <div className="flex flex-wrap items-center gap-2">
              <PaymentStatusBadge status="unpaid" />
              <PaymentStatusBadge status="pending" />
              <PaymentStatusBadge status="paid" />
              <PaymentStatusBadge status="payout_released" />
              <PaymentStatusBadge status="refunded" />
              <PaymentStatusBadge status="partially_refunded" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Dispute</p>
            <div className="flex flex-wrap items-center gap-2">
              <ParticipantDisputeStatusBadge status="open" />
              <ParticipantDisputeStatusBadge status="under_review" />
              <ParticipantDisputeStatusBadge status="resolved" />
              <ParticipantDisputeStatusBadge status="closed" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Vendor</p>
            <div className="flex flex-wrap items-center gap-2">
              <VendorApprovalStatusBadge status="pending" />
              <VendorApprovalStatusBadge status="approved" />
              <VendorApprovalStatusBadge status="banned" />
              <VendorProfileStatusBadge status="draft" />
              <VendorProfileStatusBadge status="submitted" />
              <VendorProfileStatusBadge status="complete" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-3">Admin</p>
            <div className="flex flex-wrap items-center gap-2">
              <AccountStatusBadge suspended={false} />
              <AccountStatusBadge suspended={true} />
              <ReviewVisibilityBadge hidden={false} />
              <ReviewVisibilityBadge hidden={true} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          aria-label="Preview filter"
          value={segment}
          onChange={setSegment}
          options={[
            { value: "needsAction", label: "Needs action", count: 3 },
            { value: "upcoming", label: "Upcoming" },
            { value: "completed", label: "Completed" },
          ]}
        />
      </Section>

      <Section title="Toast">
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => showToast({ title: "Request sent", tone: "success" })}>
            Show success toast
          </Button>
          <Button
            variant="secondary"
            onClick={() => showToast({ title: "Something went wrong", tone: "error" })}
          >
            Show error toast
          </Button>
        </div>
      </Section>

      <Section title="Drawer">
        <Button onClick={() => setDrawerOpen(true)}>Open drawer</Button>
        <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title="Preview drawer" subtitle="Focus-trapped, Escape to close">
          <p className="text-sm text-ink-2">Drawer content goes here.</p>
        </Drawer>
      </Section>

      <Section title="Loading">
        <div className="space-y-6">
          <LoadingState label="Loading…" variant="inline" />
          <LoadingState label="Loading dashboard…" variant="centered" />
          <LoadingSpinner size="lg" />
        </div>
      </Section>

      <Section title="Skeleton">
        <div className="space-y-4">
          <Skeleton className="h-4 w-40" />
          <SkeletonListRows rows={2} />
          <SkeletonDetailHeader />
        </div>
      </Section>

      <Section title="EmptyState">
        <EmptyState
          icon={<Inbox className="h-8 w-8" />}
          title="No bookings yet"
          description="Browse vendors to send your first request."
          action={<Button size="sm">Browse vendors</Button>}
        />
      </Section>

      <Section title="Form primitives">
        <div className="space-y-4">
          <TextField label="Event name" placeholder="Amaka's 30th birthday" />
          <TextField label="Email" error="Enter a valid email address" defaultValue="not-an-email" />
          <PasswordField label="Password" hint="At least 8 characters" />
          <PasswordField label="Password" error="Password is too short" defaultValue="abc" />
          <TextField label="Disabled" disabled defaultValue="Cannot edit" />
          <TextField label="With hint" hint="Shown to clients" />
          <TextField label="Event date" type="date" />
          <DateInput />
          <TextArea label="Notes" placeholder="Anything the vendor should know?" />
          <Select label="Event type" defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            <option value="wedding">Wedding</option>
            <option value="birthday">Birthday</option>
          </Select>
        </div>
      </Section>

      <Section title="Card">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card variant="portal">
            <Card.Header>
              <p className="text-sm font-medium text-ink">Portal card</p>
            </Card.Header>
            <Card.Body>
              <p className="text-sm text-ink-2">Header, body and footer slots.</p>
            </Card.Body>
            <Card.Footer>
              <Button size="sm" variant="secondary">
                Cancel
              </Button>
              <Button size="sm">Save</Button>
            </Card.Footer>
          </Card>
          <Card variant="muted" padding="md">
            <p className="text-sm text-ink-2">Muted card (surface-3)</p>
          </Card>
          <Card variant="callout" padding="md">
            <p className="text-sm text-primary">Callout card (brand tint)</p>
          </Card>
          <Card variant="admin" padding="md">
            <p className="text-sm text-ink-2">Admin card</p>
          </Card>
          <Card variant="portal-inset" padding="md">
            <p className="text-sm text-ink-2">Inset card</p>
          </Card>
        </div>
      </Section>

      <Section title="Banner">
        <div className="space-y-3">
          {ALL_TONES.map((tone) => (
            <Banner
              key={tone}
              tone={tone}
              icon={tone === "danger" || tone === "warning" ? <AlertTriangle className="h-5 w-5" /> : <Info className="h-5 w-5" />}
              title={`${tone} banner`}
              action={<Button size="sm" variant="secondary">Action</Button>}
            >
              Supporting text explains what happened and what to do next.
            </Banner>
          ))}
        </div>
      </Section>

      <Section title="Chip">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={chipActive} onClick={() => setChipActive((previous) => !previous)}>
            Toggle me
          </Chip>
          <Chip>Inactive</Chip>
          <Chip active>Active</Chip>
          <Chip disabled>Disabled</Chip>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs
          aria-label="Preview tabs"
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: "All", count: 12 },
            { value: "active", label: "Active", count: 4 },
            { value: "closed", label: "Closed" },
          ]}
        />
      </Section>

      <Section title="Stepper">
        <div className="space-y-6">
          <Stepper steps={["Basics", "Services", "Photos", "Review"]} current={0} />
          <Stepper steps={["Basics", "Services", "Photos", "Review"]} current={2} />
        </div>
      </Section>

      <Section title="PageHeader">
        <PageHeader
          eyebrow="Vendor"
          title="Bookings"
          description="Requests and confirmed events in one place."
          actions={<Button size="sm">New quote</Button>}
        />
      </Section>

      <Section title="StatTile">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="Revenue" value="£4,200" delta="+12% this month" deltaTone="success" />
          <StatTile label="Enquiries" value="18" delta="-3 this week" deltaTone="danger" />
          <StatTile label="Rating" value="4.8" />
        </div>
      </Section>

      <Section title="Avatar">
        <div className="flex items-center gap-3">
          <Avatar name="Amaka Obi" size="sm" />
          <Avatar name="Amaka Obi" size="md" />
          <Avatar name="Amaka Obi" size="lg" />
          <Avatar name="Single" />
        </div>
      </Section>

      <Section title="DescriptionList">
        <DescriptionList
          items={[
            { label: "Event", value: "Wedding reception" },
            { label: "Date", value: "12 Jun 2027" },
            { label: "Total", value: "£1,250.00" },
          ]}
        />
      </Section>

      <Section title="SectionBlock and CollapsibleSection">
        <SectionBlock title="Section title" description="Lighter header: sans, 16px, medium.">
          <p className="text-sm text-ink-2">Section body.</p>
        </SectionBlock>
        <CollapsibleSection title="Collapsible" subtitle="Open by default" badge="2 items">
          <p className="text-sm text-ink-2">Collapsible body.</p>
        </CollapsibleSection>
      </Section>

      <Section title="Modal and ConfirmDialog">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Open modal
          </Button>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Open confirm dialog
          </Button>
        </div>
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Preview modal"
          maxWidthClassName="max-w-lg"
          footer={<Button onClick={() => setModalOpen(false)}>Done</Button>}
        >
          <p className="text-sm text-ink-2">Modal content with the new scrim and overlay shadow.</p>
        </Modal>
        <ConfirmDialog
          isOpen={confirmOpen}
          title="Cancel this booking?"
          description="This cannot be undone."
          confirmLabel="Cancel booking"
          confirmVariant="destructive"
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </Section>

      <Section title="Tooltip and BackLink">
        <div className="flex flex-wrap items-center gap-6">
          <Tooltip hint="A short explanation.">
            <Button variant="secondary" size="sm">
              Hover me
            </Button>
          </Tooltip>
          <BackLink href="/internal/ui-kit" label="Back (primary)" />
          <BackLink href="/internal/ui-kit" label="Back (muted)" tone="muted" />
        </div>
      </Section>
    </main>
  );
}
