"use client";

import Link from "next/link";
import { AlertCircle, ChevronRight, Info, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { adminCard } from "@/features/admin/adminTheme";

export type AdminAttentionItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  ctaLabel?: string;
  tone?: "urgent" | "info" | "positive";
};

const TONE_ICON = {
  urgent: AlertCircle,
  info: Info,
  positive: Sparkles,
} as const;

const TONE_CLASS = {
  urgent: "text-amber-600",
  info: "text-neutral-400",
  positive: "text-primary",
} as const;

type AdminAttentionListProps = {
  title?: string;
  subtitle?: string;
  items: AdminAttentionItem[];
  emptyTitle?: string;
};

export function AdminAttentionList({
  title = "Needs attention",
  subtitle,
  items,
  emptyTitle = "All clear",
}: AdminAttentionListProps) {
  return (
    <section className={`${adminCard} overflow-hidden`}>
      <div className="border-b border-neutral-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-neutral-500">{subtitle}</p> : null}
        {!subtitle && items.length > 0 ? (
          <p className="mt-0.5 text-xs text-neutral-400">
            {items.length} item{items.length === 1 ? "" : "s"}
          </p>
        ) : null}
      </div>
      {items.length === 0 ? (
        <EmptyState
          className="border-0 shadow-none"
          icon={<Sparkles className="h-7 w-7" strokeWidth={1.5} />}
          title={emptyTitle}
        />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((item) => {
            const tone = item.tone ?? "info";
            const Icon = TONE_ICON[tone];
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-neutral-50/80"
                >
                  <Icon className={`h-4 w-4 shrink-0 ${TONE_CLASS[tone]}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                    {item.subtitle ? (
                      <p className="truncate text-xs text-neutral-500">{item.subtitle}</p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-neutral-500">
                    {item.ctaLabel ?? "Open"}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
