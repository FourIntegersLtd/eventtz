"use client";

import {
  Ban,
  EllipsisVertical,
  Loader2,
  Mail,
  Trash2,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FOCUS_RING, TOUCH_TARGET } from "@/components/ui/tokens";

type MenuItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  tone?: "default" | "danger";
  disabled?: boolean;
  onSelect: () => void | Promise<void>;
};

type MenuRect = {
  top: number;
  left: number;
  minWidth: number;
};

type AdminTeamMemberActionsMenuProps = {
  memberEmail: string | null;
  suspended: boolean;
  busy: boolean;
  onSendResetLink: () => void | Promise<void>;
  onToggleSuspend: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
};

const MENU_MIN_WIDTH = 208;

export function AdminTeamMemberActionsMenu({
  memberEmail,
  suspended,
  busy,
  onSendResetLink,
  onToggleSuspend,
  onDelete,
}: AdminTeamMemberActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuRect, setMenuRect] = useState<MenuRect | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const menuId = useId();
  const label = memberEmail ?? "team member";

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateMenuRect = () => {
    const button = buttonRef.current;
    if (!button) {
      setMenuRect(null);
      return;
    }
    const rect = button.getBoundingClientRect();
    const left = Math.max(8, rect.right - MENU_MIN_WIDTH);
    setMenuRect({
      top: rect.bottom + 6,
      left,
      minWidth: MENU_MIN_WIDTH,
    });
  };

  useEffect(() => {
    if (!open) {
      setMenuRect(null);
      return;
    }
    updateMenuRect();
    window.addEventListener("resize", updateMenuRect);
    window.addEventListener("scroll", updateMenuRect, true);
    return () => {
      window.removeEventListener("resize", updateMenuRect);
      window.removeEventListener("scroll", updateMenuRect, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items: MenuItem[] = [
    {
      id: "reset",
      label: "Send reset link",
      icon: Mail,
      onSelect: async () => {
        setOpen(false);
        await onSendResetLink();
      },
    },
    {
      id: "suspend",
      label: suspended ? "Reactivate" : "Suspend",
      icon: suspended ? UserCheck : Ban,
      onSelect: async () => {
        setOpen(false);
        await onToggleSuspend();
      },
    },
    {
      id: "delete",
      label: "Delete admin",
      icon: Trash2,
      tone: "danger",
      onSelect: async () => {
        setOpen(false);
        if (
          !window.confirm(
            `Delete ${label}?\n\nAdmin-only accounts are permanently deleted. If this person also uses Eventtz as a client or vendor, only their admin access is removed.`,
          )
        ) {
          return;
        }
        await onDelete();
      },
    },
  ];

  const menu =
    mounted && open && menuRect
      ? createPortal(
          <ul
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={`Actions for ${label}`}
            className="overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
            style={{
              position: "fixed",
              top: menuRect.top,
              left: menuRect.left,
              minWidth: menuRect.minWidth,
              zIndex: 9999,
            }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => void item.onSelect()}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-neutral-50 disabled:opacity-50 ${TOUCH_TARGET} ${
                      item.tone === "danger"
                        ? "text-red-700 hover:bg-red-50"
                        : "text-neutral-800"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        item.tone === "danger" ? "text-red-600" : "text-neutral-500"
                      }`}
                      aria-hidden
                    />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative inline-flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Actions for ${label}`}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-9 w-7 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-60 ${FOCUS_RING}`}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <EllipsisVertical className="h-4 w-4" aria-hidden />
        )}
      </button>
      {menu}
    </div>
  );
}
