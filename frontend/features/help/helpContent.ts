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

/** Tailwind prose classes for helpMarkdownToHtml output in co-pilot / help UI. */
export const helpMarkdownProseClassName =
  "[&_p]:mt-2 [&_p:first-child]:mt-0 [&_strong]:font-semibold [&_strong]:text-neutral-900 [&_h2]:mt-4 [&_h2]:text-base [&_h3]:mt-3 [&_h3]:text-sm [&_ul]:mt-2 [&_ol]:mt-2 [&_li]:leading-relaxed";

const NOTE_CALLOUT =
  "mt-5 flex gap-3 rounded-xl bg-sky-50 px-4 py-3 text-[15px] leading-relaxed text-sky-950 sm:text-[14px]";
const WARN_CALLOUT =
  "mt-5 flex gap-3 rounded-xl border border-orange-200/80 bg-orange-50 px-4 py-3 text-[15px] leading-relaxed text-orange-950 sm:text-[14px]";
const NOTE_ICON =
  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-200 text-[11px] font-bold text-sky-800";
const WARN_ICON =
  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-200 text-[11px] font-bold text-orange-900";

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /`([^`]+)`/g,
      '<code class="rounded bg-neutral-100 px-1 text-[0.9em]">$1</code>',
    );
}

function quoteBody(line: string): string {
  return line.replace(/^>\s?/, "");
}

function isCalloutStart(line: string): "NOTE" | "WARNING" | null {
  const t = line.trim();
  if (/^>\s*\[!NOTE\]\s*$/i.test(t) || /^>\s*\[!INFO\]\s*$/i.test(t)) return "NOTE";
  if (/^>\s*\[!WARNING\]\s*$/i.test(t) || /^>\s*\[!WARN\]\s*$/i.test(t)) return "WARNING";
  return null;
}

/** Very small markdown → safe-ish HTML for help articles (headings, lists, bold, callouts, paragraphs). */
export function helpMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
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
      const cls = kind === "WARNING" ? WARN_CALLOUT : NOTE_CALLOUT;
      const iconCls = kind === "WARNING" ? WARN_ICON : NOTE_ICON;
      const icon = kind === "WARNING" ? "!" : "i";
      const inner = body.length
        ? body.map((p) => `<p class="m-0">${inline(p)}</p>`).join("")
        : "";
      html.push(
        `<div class="${cls}" role="note"><span class="${iconCls}" aria-hidden="true">${icon}</span><div class="min-w-0 flex-1 space-y-1">${inner}</div></div>`,
      );
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
        `<h3 class="mt-8 flex items-start gap-3 text-neutral-900"><span class="font-heading w-7 shrink-0 text-[1.75rem] font-semibold leading-none text-neutral-300">${escapeHtml(step[1])}</span><span class="font-heading pt-0.5 text-base font-semibold">${inline(step[2])}</span></h3>`,
      );
      i += 1;
      continue;
    }

    if (line.startsWith("### ")) {
      closeLists();
      html.push(
        `<h3 class="font-heading mt-6 text-base font-semibold text-neutral-900">${inline(line.slice(4))}</h3>`,
      );
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      closeLists();
      html.push(
        `<h2 class="font-heading mt-8 text-lg font-semibold text-neutral-900">${inline(line.slice(3))}</h2>`,
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
        html.push('<ol class="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-neutral-700">');
        inOl = true;
      }
      html.push(`<li>${inline(ol[1])}</li>`);
      i += 1;
      continue;
    }
    if (line.startsWith("- ")) {
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul class="mt-3 list-disc space-y-2 pl-5 text-sm text-neutral-700">');
        inUl = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
      i += 1;
      continue;
    }
    closeLists();
    html.push(
      `<p class="mt-3 text-[15px] leading-relaxed text-neutral-700 sm:text-[14px]">${inline(line.trim())}</p>`,
    );
    i += 1;
  }
  closeLists();
  return html.join("\n");
}
