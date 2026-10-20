"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { PortfolioLightbox } from "@/features/vendors/display/PortfolioLightbox";
import type { AdminListingMediaSavePayload } from "@/lib/adminVendorsApi";
import {
  adminListingMediaItemsFromPayload,
  adminListingMediaMatchesDefault,
  adminListingMediaStateFromItems,
  type AdminListingMediaItem,
} from "@/features/admin/vendors/adminListingMedia";

type AdminListingMediaEditorProps = {
  vendorUserId: string;
  profileFormData: Record<string, unknown>;
  portfolioImageUrls: string[];
  disabled?: boolean;
  onSave: (payload: AdminListingMediaSavePayload) => Promise<boolean>;
};

function SortableMediaTile({
  item,
  isMain,
  disabled,
  saving,
  onToggleHidden,
  onPreview,
}: {
  item: AdminListingMediaItem;
  isMain: boolean;
  disabled: boolean;
  saving: boolean;
  onToggleHidden: (url: string) => void;
  onPreview: (url: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.url, disabled: disabled || saving });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative h-14 w-full overflow-hidden rounded-md border bg-neutral-50 transition ${
        item.hidden ? "border-neutral-200 opacity-55" : "border-neutral-200"
      } ${isDragging ? "z-20 shadow-md ring-2 ring-primary/25" : ""}`}
    >
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => onPreview(item.url)}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-inset"
        aria-label={`Open ${item.label} fullscreen`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt=""
          className="h-full w-full cursor-zoom-in object-cover object-center"
          decoding="async"
        />
      </button>
      <button
        type="button"
        className={`absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-br-md bg-white/90 text-neutral-500 shadow-sm ${
          disabled || saving ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing"
        }`}
        aria-label={`Drag ${item.label}`}
        disabled={disabled || saving}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => onToggleHidden(item.url)}
        className="absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-tl-md bg-white/90 text-neutral-700 shadow-sm hover:bg-white disabled:opacity-50"
        aria-label={item.hidden ? `Show ${item.label}` : `Hide ${item.label}`}
      >
        {item.hidden ? (
          <Eye className="h-3 w-3" aria-hidden />
        ) : (
          <EyeOff className="h-3 w-3" aria-hidden />
        )}
      </button>
      {isMain ? (
        <span className="pointer-events-none absolute right-0 top-0 rounded-bl-md bg-primary px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          Main
        </span>
      ) : null}
    </div>
  );
}

export function AdminListingMediaEditor({
  vendorUserId,
  profileFormData,
  portfolioImageUrls,
  disabled = false,
  onSave,
}: AdminListingMediaEditorProps) {
  const payload = useMemo(
    () => ({
      ...profileFormData,
      portfolioFileNames: portfolioImageUrls,
    }),
    [profileFormData, portfolioImageUrls],
  );

  const initialItems = useMemo(
    () => adminListingMediaItemsFromPayload(payload),
    [payload],
  );

  const [items, setItems] = useState(initialItems);
  const [saving, setSaving] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [vendorUserId, initialItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const previewUrls = useMemo(() => items.map((item) => item.url), [items]);

  const openPreview = (url: string) => {
    const index = previewUrls.indexOf(url);
    if (index >= 0) setLightboxIndex(index);
  };

  const mainUrl = items.find((item) => !item.hidden)?.url ?? null;

  const persist = async (nextItems: AdminListingMediaItem[]) => {
    setSaving(true);
    try {
      const state = adminListingMediaStateFromItems(nextItems);
      const isDefault = adminListingMediaMatchesDefault(nextItems, payload);
      const ok = await onSave(
        isDefault
          ? { displayOrder: [], hiddenImageUrls: [] }
          : state,
      );
      if (ok) setItems(nextItems);
      return ok;
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || disabled || saving) return;
    const oldIndex = items.findIndex((item) => item.url === active.id);
    const newIndex = items.findIndex((item) => item.url === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextItems = arrayMove(items, oldIndex, newIndex);
    await persist(nextItems);
  };

  const handleToggleHidden = async (url: string) => {
    if (disabled || saving) return;
    const nextItems = items.map((item) =>
      item.url === url ? { ...item, hidden: !item.hidden } : item,
    );
    await persist(nextItems);
  };

  const handleReset = async () => {
    if (disabled || saving) return;
    setSaving(true);
    try {
      const ok = await onSave({ displayOrder: [], hiddenImageUrls: [] });
      if (ok) setItems(adminListingMediaItemsFromPayload(payload));
    } finally {
      setSaving(false);
    }
  };

  if (items.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No images available to manage for this listing.</p>
    );
  }

  const hasOverrides = !adminListingMediaMatchesDefault(items, payload);
  const subjectName =
    typeof profileFormData.businessName === "string" && profileFormData.businessName.trim()
      ? profileFormData.businessName.trim()
      : "Vendor";

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-snug text-neutral-500">
        Drag to reorder · click to enlarge · first visible photo is the main image
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
        <SortableContext items={items.map((item) => item.url)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
            {items.map((item) => (
              <SortableMediaTile
                key={`${vendorUserId}-${item.url}`}
                item={item}
                isMain={!item.hidden && item.url === mainUrl}
                disabled={disabled}
                saving={saving}
                onToggleHidden={(url) => void handleToggleHidden(url)}
                onPreview={openPreview}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      {lightboxIndex != null ? (
        <PortfolioLightbox
          urls={previewUrls}
          index={lightboxIndex}
          alt={`${subjectName} listing photo`}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      ) : null}
      {hasOverrides ? (
        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => void handleReset()}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          Reset to vendor default order
        </button>
      ) : null}
    </div>
  );
}
