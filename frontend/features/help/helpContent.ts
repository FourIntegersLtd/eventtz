import {
  BookOpen,
  CalendarDays,
  MessageSquare,
  Rocket,
  Settings,
  ShieldAlert,
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
  if (audience === "admin") return null;
  return audience === "client" ? "/client/contact" : "/vendor/contact";
}

export function helpCategoryIcon(iconKey: string): LucideIcon {
  switch (iconKey) {
    case "book":
      return BookOpen;
    case "rocket":
      return Rocket;
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

/** Very small markdown → safe-ish HTML for help articles (headings, lists, bold, paragraphs). */
export function helpMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inUl = false;
  let inOl = false;

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

  const inline = (text: string) =>
    text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code class=\"rounded bg-neutral-100 px-1 text-[0.9em]\">$1</code>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      closeLists();
      continue;
    }
    if (line.startsWith("### ")) {
      closeLists();
      html.push(`<h3 class="font-heading mt-5 text-base font-semibold text-neutral-900">${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith("## ")) {
      closeLists();
      html.push(`<h2 class="font-heading mt-6 text-lg font-semibold text-neutral-900">${inline(line.slice(3))}</h2>`);
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
      continue;
    }
    if (line.startsWith("- ")) {
      if (inOl) {
        html.push("</ol>");
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul class="mt-3 list-disc space-y-1.5 pl-5 text-sm text-neutral-700">');
        inUl = true;
      }
      html.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    closeLists();
    html.push(`<p class="mt-3 text-sm leading-relaxed text-neutral-700">${inline(line.trim())}</p>`);
  }
  closeLists();
  return html.join("\n");
}
