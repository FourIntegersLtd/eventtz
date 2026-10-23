"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { AlertCircle, ChevronRight, Info, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export type AdminAttentionItem = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
  /** Count pill, for example "6 pending". */
  badge?: string;
  tone?: "urgent" | "info" | "positive";
};

const TONE_ICON = {
  urgent: AlertCircle,
  info: Info,
  positive: Sparkles,
} as const;

const TONE_CLASS = {
  urgent: "text-amber-600",
  info: "text-ink-3",
  positive: "text-primary",
} as const;

type AdminAttentionListProps = {
  title?: string;
  subtitle?: string;
  items: AdminAttentionItem[];
  emptyTitle?: string;
};

export function AdminAttentionList({
  title = "Needs action",
  subtitle,
  items,
  emptyTitle = "All clear",
}: AdminAttentionListProps) {
  const countLine =
    subtitle ??
    (items.length > 0 ? `${items.length} item${items.length === 1 ? "" : "s"}` : undefined);

  return (
    <Card as="section">
      <Card.Header>
        <div>
          <h2 className="ez-h3">{title}</h2>
          {countLine ? <p className="ez-small">{countLine}</p> : null}
        </div>
      </Card.Header>
      {items.length === 0 ? (
        <EmptyState
          className="border-0 shadow-none"
          lottie="allCaughtUp"
          title={emptyTitle}
        />
      ) : (
        <div>
          {items.map((item) => {
            const tone = item.tone ?? "info";
            const Icon = TONE_ICON[tone];
            return (
              <Link key={item.id} href={item.href} className="ez-list-row">
                <Icon className={`h-4 w-4 shrink-0 ${TONE_CLASS[tone]}`} aria-hidden />
                <div className="ez-list-row__main">
                  <span className="ez-strong">{item.title}</span>
                  {item.subtitle ? <span className="ez-caption truncate">{item.subtitle}</span> : null}
                </div>
                {item.badge ? (
                  <Badge tone={tone === "urgent" ? "warning" : "neutral"}>{item.badge}</Badge>
                ) : null}
                <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
