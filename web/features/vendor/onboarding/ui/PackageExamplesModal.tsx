"use client";

import { Package } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { packageExamplesForServices } from "../../../../lib/vendorOnboarding/packageExamples";

type Props = {
  servicesOffered: string[];
};

export function PackageExamplesModal({ servicesOffered }: Props) {
  const [open, setOpen] = useState(false);
  const examples = packageExamplesForServices(servicesOffered);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2.5 rounded-xl border-2 border-primary/35 bg-primary/10 px-5 py-4 text-base font-semibold text-primary shadow-sm transition hover:border-primary/50 hover:bg-primary/15 active:scale-[0.99]"
      >
        <Package className="h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
        What is a package?
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="What is an item / package?"
        maxWidthClassName="max-w-md"
        bodyMaxHeightClassName=""
        bodyClassName="bg-white"
        footer={
          <div className="flex justify-end">
            <Button type="button" onClick={() => setOpen(false)}>
              Got it
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-1 text-sm leading-relaxed text-neutral-700">
          <p>
            A package is something a customer can{" "}
            <strong className="font-semibold text-neutral-900">choose and book</strong> from you, not
            your whole business. Each package needs a clear name, a price, and exactly what&apos;s
            included.
          </p>
          <p className="rounded-lg border border-primary/15 bg-primary/[0.04] px-3 py-2.5 text-xs text-neutral-700">
            <span className="font-semibold text-neutral-900">Good rule: </span>
            A client should understand what they&apos;re buying without messaging you for basic
            details.
          </p>
          <div>
            <p className="font-semibold text-neutral-900">Examples for {examples.label}</p>
            <p className="mt-1 text-xs text-neutral-600">{examples.intro}</p>
            <ul className="mt-3 space-y-2">
              {examples.examples.map((ex) => (
                <li
                  key={ex.name}
                  className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5"
                >
                  <p className="text-sm font-semibold text-neutral-900">
                    {ex.name} – {ex.price}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-600">{ex.included}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Modal>
    </>
  );
}
