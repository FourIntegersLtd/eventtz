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
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { PortfolioLightbox } from "@/features/vendors/display/PortfolioLightbox";
import type { AdminListingMediaSavePayload } from "@/lib/adminVendorsApi";
import {
  adminListingMediaItemsFromPayload,
  adminListingMediaMatchesDefault,
  adminListingMediaStateFromItems,
  publicListingImageUrlsFromPayload,
  type AdminListingMediaItem,
} from "@/lib/vendorPortfolioImages";

type AdminListingMediaEditorProps = {
  vendorUserId: string;
  profileFormData: Record<string, unknown>;
  portfolioImageUrls: string[];
  disabled?: boolean;
  onSave: (payload: AdminListingMediaSavePayload) => Promise<boolean>;
};

function SortableMediaRow({
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
      className={`flex items-stretch gap-2 rounded-xl border bg-white transition ${
        item.hidden ? "border-neutral-200 opacity-60" : "border-neutral-200"
      } ${isDragging ? "z-20 shadow-lg ring-2 ring-primary/20" : ""}`}
    >
      <button
        type="button"
        className={`flex shrink-0 items-center px-2 text-neutral-400 hover:text-neutral-600 ${
          disabled || saving ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing"
        }`}
        aria-label={`Drag ${item.label}`}
        disabled={disabled || saving}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled || saving}
        onClick={() => onPreview(item.url)}
        className="relative min-w-0 flex-1 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        aria-label={`Open ${item.label} fullscreen`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt=""
          className="aspect-[16/10] w-full cursor-zoom-in object-cover object-top"
          decoding="async"
        />
        {isMain ? (
          <span className="pointer-events-none absolute bottom-2 left-2 inline-flex rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm">
            Main
          </span>
        ) : null}
        {item.hidden ? (
          <span className="pointer-events-none absolute bottom-2 right-2 inline-flex rounded-full bg-neutral-900/75 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            Hidden
          </span>
        ) : null}
      </button>
      <div className="flex shrink-0 flex-col justify-center gap-1 pr-2">
        <span className="text-[11px] font-medium text-neutral-500">{item.label}</span>
        <button
          type="button"
          disabled={disabled || saving}
          onClick={() => onToggleHidden(item.url)}
          className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
        >
          {item.hidden ? (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Show
            </>
          ) : (
            <>
              <EyeOff className="h-3.5 w-3.5" aria-hidden />
              Hide
            </>
          )}
        </button>
      </div>
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

  const mainUrl = useMemo(() => {
    const previewPayload = {
      ...payload,
      listingDisplayOrder: items.map((item) => item.url),
      listingHiddenImageUrls: items.filter((item) => item.hidden).map((item) => item.url),
    };
    return publicListingImageUrlsFromPayload(previewPayload)[0] ?? null;
  }, [items, payload]);

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
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Drag to reorder. Click a photo to view fullscreen. First visible photo is the main listing
        image. Hidden photos are not shown to clients.
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
        <SortableContext items={items.map((item) => item.url)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortableMediaRow
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
