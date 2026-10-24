import {
  BookOpen,
  CalendarDays,
  MessageSquare,
  Rocket,
  Settings,
  ShieldAlert,
  Sparkles,
  UserCircle2,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { HelpAudience } from "@/lib/helpApi";

export function helpBasePath(audience: HelpAudience): string {
  if (audience === "admin") return "/admin/dashboard";
  return audience === "client" ? "/client/help" : "/vendor/help";
}

export function helpContactPath(audience: HelpAudience): string | null {
  if (audience === "admin") return "/admin/report-bug";
  return audience === "client" ? "/client/help?tab=contact" : "/vendor/help?tab=contact";
}

export function helpCategoryIcon(iconKey: string): LucideIcon {
  switch (iconKey) {
    case "book":
      return BookOpen;
    case "rocket":
      return Rocket;
    case "sparkles":
      return Sparkles;
    case "calendar":
      return CalendarDays;
    case "wallet":
      return Wallet;
    case "message":
      return MessageSquare;
    case "shield":
      return ShieldAlert;
    case "settings":
      return Settings;
    case "user":
      return UserCircle2;
    default:
      return BookOpen;
  }
}

export type HelpCategoryIconVisual = {
  shell: string;
  icon: string;
};

const HELP_CATEGORY_ICON_SHELL =
  "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ring-primary-border/50";

const DEFAULT_HELP_CATEGORY_ICON_VISUAL: HelpCategoryIconVisual = {
  shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-soft`,
  icon: "text-primary",
};

const HELP_CATEGORY_ICON_VISUALS: Record<string, HelpCategoryIconVisual> = {
  book: DEFAULT_HELP_CATEGORY_ICON_VISUAL,
  rocket: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-muted`,
    icon: "text-primary",
  },
  sparkles: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-soft`,
    icon: "text-accent-violet",
  },
  calendar: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-muted`,
    icon: "text-accent-violet",
  },
  wallet: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-soft`,
    icon: "text-primary",
  },
  message: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-muted`,
    icon: "text-accent-violet",
  },
  shield: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-soft`,
    icon: "text-primary",
  },
  settings: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-muted`,
    icon: "text-primary",
  },
  user: {
    shell: `${HELP_CATEGORY_ICON_SHELL} bg-primary-soft`,
    icon: "text-accent-violet",
  },
};

export function helpCategoryIconVisual(iconKey: string): HelpCategoryIconVisual {
  return HELP_CATEGORY_ICON_VISUALS[iconKey] ?? DEFAULT_HELP_CATEGORY_ICON_VISUAL;
}

/** Tailwind prose classes for helpMarkdownToHtml output in co-pilot / help UI. */
export const helpMarkdownProseClassName =
  "[&_p]:mt-2 [&_p:first-child]:mt-0 [&_strong]:font-semibold [&_strong]:text-ink [&_h2]:mt-4 [&_h2]:text-base [&_h3]:mt-3 [&_h3]:text-sm [&_ul]:mt-2 [&_ol]:mt-2 [&_li]:leading-relaxed";

type CalloutKind = "NOTE" | "WARNING" | "IMPORTANT";

const CALLOUT_BASE =
  "help-callout mt-6 rounded-xl border px-4 py-3.5 text-[15px] leading-relaxed sm:mt-5 sm:text-[14px]";

const CALLOUT_STYLES: Record<CalloutKind, { box: string; text: string; icon: string }> = {
  NOTE: {
    box: `${CALLOUT_BASE} help-callout--note border-sky-200 bg-sky-50`,
    text: "text-sky-950",
    icon: "text-sky-600",
  },
  WARNING: {
    box: `${CALLOUT_BASE} help-callout--warning border-orange-200 bg-orange-50`,
    text: "text-orange-950",
    icon: "text-orange-600",
  },
  IMPORTANT: {
    box: `${CALLOUT_BASE} help-callout--important border-red-200 bg-red-50`,
    text: "text-red-950",
    icon: "text-red-600",
  },
};

const INFO_ICON =
  '<svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

const WARN_ICON =
  '<svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>';

const IMPORTANT_ICON =
  '<svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>';

const CALLOUT_ICONS: Record<CalloutKind, string> = {
  NOTE: INFO_ICON,
  WARNING: WARN_ICON,
  IMPORTANT: IMPORTANT_ICON,
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-surface-3 px-1 text-[0.9em]">$1</code>',
    );
}

function formatListItemContent(text: string): string {
  const insideBold = text.match(/^\*\*(.+?[.:])\*\*(.*)$/);
  if (insideBold) {
    const [, label, rest] = insideBold;
    const suffix = rest.trim() ? ` ${rest.trim()}` : "";
    return `<span class="help-list-label font-semibold text-ink">${escapeHtml(label)}</span>${inline(suffix)}`;
  }
  const outsideBold = text.match(/^\*\*(.+?)\*\*([:.])(.*)$/);
  if (outsideBold) {
    const [, label, punct, rest] = outsideBold;
    const suffix = rest.trim() ? ` ${rest.trim()}` : "";
    return `<span class="help-list-label font-semibold text-ink">${escapeHtml(label)}${punct}</span>${inline(suffix)}`;
  }
  return inline(text);
}

function quoteBody(line: string): string {
  return line.replace(/^>\s?/, "");
}

function isCalloutStart(line: string): CalloutKind | null {
  const t = line.trim();
  if (/^>\s*\[!NOTE\]\s*$/i.test(t) || /^>\s*\[!INFO\]\s*$/i.test(t)) return "NOTE";
  if (/^>\s*\[!WARNING\]\s*$/i.test(t) || /^>\s*\[!WARN\]\s*$/i.test(t)) return "WARNING";
  if (/^>\s*\[!IMPORTANT\]\s*$/i.test(t)) return "IMPORTANT";
  return null;
}

function renderCallout(kind: CalloutKind, body: string[]): string {
  const styles = CALLOUT_STYLES[kind];
  if (!body.length) {
    return `<div class="${styles.box} ${styles.text}" role="note"></div>`;
  }
  const iconHtml = `<span class="help-callout-icon mr-2 inline-flex translate-y-[0.125em] align-bottom ${styles.icon}">${CALLOUT_ICONS[kind]}</span>`;
  const paragraphs = body.map((p, index) => {
    if (index === 0) {
      return `<p class="m-0">${iconHtml}${inline(p)}</p>`;
    }
    return `<p class="m-0 mt-1">${inline(p)}</p>`;
  });
  return `<div class="${styles.box} ${styles.text}" role="note">${paragraphs.join("")}</div>`;
}

/** Very small markdown → safe-ish HTML for help articles (headings, lists, bold, callouts, paragraphs). */
export function helpMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  const deferredCallouts: string[] = [];
  let inUl = false;
  let inOl = false;
  let i = 0;

  const closeLists = () => {
    if (inUl) {
      html.push("</ul>");
      inUl = false;
    }
    if (inOl) {
      html.push("</ol>");
      inOl = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i]?.trimEnd() ?? "";
    const kind = isCalloutStart(line);
    if (kind) {
      closeLists();
      const body: string[] = [];
      i += 1;
      while (i < lines.length) {
        const next = lines[i]?.trimEnd() ?? "";
        if (!next.trim()) break;
        if (!next.trimStart().startsWith(">")) break;
        if (isCalloutStart(next)) break;
        body.push(quoteBody(next).trim());
        i += 1;
      }
      deferredCallouts.push(renderCallout(kind, body));
      continue;
    }

    if (!line.trim()) {
      closeLists();
      i += 1;
      continue;
    }

    const step = line.match(/^###\s+(\d+)\.\s+(.*)$/);
    if (step) {
      closeLists();
      html.push(
        `<h3 class="mt-8 flex items-start gap-3 text-ink"><span class="font-heading w-7 shrink-0 text-[1.75rem] font-semibold leading-none text-primary/25">${escapeHtml(step[1])}</span><span class="font-heading pt-0.5 text-base font-semibold">${inline(step[2])}</span></h3>`,
      );
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      closeLists();
      html.push(
        `<h3 class="font-heading mt-6 text-base font-semibold text-ink">${inline(line.slice(4))}</h3>`,
      );
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      closeLists();
      html.push(
        `<h2 class="font-heading mt-9 text-lg font-semibold text-ink">${inline(line.slice(3))}</h2>`,
      );
      i += 1;
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    if (ol) {
      if (inUl) {
        html.push("</ul>");
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol class="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">');
        inOl = true;
      }
      html.push(`<li>${formatListItemContent(ol[1])}</li>`);
      i += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul class="mt-3 list-disc space-y-2.5 pl-5 text-sm text-ink-2">');
        inUl = true;
      }
      html.push(`<li>${formatListItemContent(line.slice(2))}</li>`);
      i += 1;
      continue;
    }
    closeLists();
    html.push(
      `<p class="mt-3 text-[15px] leading-relaxed text-ink-2 sm:text-[14px]">${inline(line.trim())}</p>`,
    );
    i += 1;
  }
  closeLists();
  if (deferredCallouts.length > 0) {
    html.push(...deferredCallouts);
  }
  return html.join("\n");
}
