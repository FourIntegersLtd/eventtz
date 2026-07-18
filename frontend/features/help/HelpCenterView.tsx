"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { portalCard, portalCardPadding } from "@/components/portal-shell/portalTheme";
import { LoadingState } from "@/components/ui/LoadingState";
import { getApiErrorDetail } from "@/lib/api-errors";
import {
  fetchHelpCategories,
  type HelpAudience,
  type HelpCategory,
} from "@/lib/helpApi";
import { MixpanelEvents, track } from "@/lib/mixpanelEvents";
import { helpBasePath, helpCategoryIcon } from "@/features/help/helpContent";

type Props = { audience: HelpAudience };

export function HelpCenterView({ audience }: Props) {
  const [categories, setCategories] = useState<HelpCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const base = helpBasePath(audience);

  useEffect(() => {
    track(MixpanelEvents.help_opened, { audience, source: "page" });
  }, [audience]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchHelpCategories(audience)
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getApiErrorDetail(e) ?? "Could not load help topics.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience]);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-neutral-900">Help Center</h1>
        <p className="mt-1 text-sm text-neutral-500">Find answers in our knowledge base</p>
      </div>

      <div className={`${portalCard} ${portalCardPadding} !p-0 overflow-hidden`}>
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-900">Documentation</h2>
        </div>
        {loading ? (
          <LoadingState label="Loading topics…" variant="inline" className="px-5 py-8" />
        ) : error ? (
          <p className="px-5 py-4 text-sm text-red-700">{error}</p>
        ) : categories.length === 0 ? (
          <p className="px-5 py-4 text-sm text-neutral-600">No help topics yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {categories.map((cat) => {
              const Icon = helpCategoryIcon(cat.icon_key);
              return (
                <li key={cat.id}>
                  <Link
                    href={`${base}/c/${encodeURIComponent(cat.slug)}`}
                    onClick={() =>
                      track(MixpanelEvents.help_opened, {
                        audience,
                        source: "category",
                        category: cat.slug,
                      })
                    }
                    className="flex items-start gap-3 px-5 py-4 transition hover:bg-neutral-50"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {cat.title}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-neutral-500">
                        {cat.description}
                      </span>
                    </span>
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="text-center text-sm text-neutral-500">
        Prefer to ask? Use the help button, or{" "}
        <Link href={`${base}/ask`} className="font-medium text-primary hover:underline">
          chat with the assistant
        </Link>
        .
      </p>
    </div>
  );
}
