"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton, SkeletonListRows, SkeletonDetailHeader } from "@/components/ui/Skeleton";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { Inbox } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-b border-neutral-100 pb-10">
      <h2 className="font-heading text-lg font-semibold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Internal-only preview of every `components/ui` primitive, for visually
 * verifying the design quality bar (motion, elevation, focus rings) before
 * it's consumed across booking/chat/notification screens. Not linked from
 * any nav; disabled outside development.
 */
export default function UiKitPage() {
  const [segment, setSegment] = useState<"needsAction" | "upcoming" | "completed">("needsAction");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { showToast } = useToast();

  if (process.env.NODE_ENV === "production") {
    return (
      <main className="min-h-screen px-6 py-16 text-center text-sm text-neutral-500">
        Not available in production.
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-10 px-6 py-12">
      <h1 className="font-heading text-2xl font-semibold text-neutral-900">UI kit preview</h1>

      <Section title="Button">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" loading>
            Loading
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
      </Section>

      <Section title="StatusBadge">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status="pending" />
          <StatusBadge status="accepted" />
          <StatusBadge status="completed" />
          <StatusBadge status="declined" />
          <StatusBadge status="cancelled" />
          <StatusBadge status="disputed" />
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
          <p className="text-sm text-neutral-600">Drawer content goes here.</p>
        </Drawer>
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
    </main>
  );
}
