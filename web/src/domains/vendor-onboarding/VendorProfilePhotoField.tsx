"use client";

/** VendorProfilePhotoField for the vendor onboarding wizard. */

import { useRef } from "react";
import { Pencil } from "lucide-react";
import { LoadingSpinner } from "@/foundation/ui/LoadingSpinner";

export type VendorProfilePhotoFieldVariant = "default" | "sidebar" | "header";

export type VendorProfilePhotoFieldProps = {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  editable?: boolean;
  uploading?: boolean;
  error?: string | null;
  onUpload?: (file: File) => void | Promise<void>;
  /** `sidebar` = desktop profile nav; `header` = compact mobile row above the section tabs. */
  variant?: VendorProfilePhotoFieldVariant;
};

const VARIANT_STYLES: Record<
  VendorProfilePhotoFieldVariant,
  {
    avatarSize: string;
    editButtonSize: string;
    editIconSize: string;
    /** `row` puts the photo beside the hint text (mobile header); `column` stacks them. */
    layout: "row" | "column";
    wrapper: string;
    hint: string;
    error: string;
  }
> = {
  default: {
    avatarSize: "h-24 w-24 text-2xl",
    editButtonSize: "h-8 w-8",
    editIconSize: "h-3.5 w-3.5",
    layout: "column",
    wrapper: "flex flex-col items-center gap-2",
    hint: "max-w-xs text-center text-xs text-neutral-500",
    error: "text-center text-xs text-red-600",
  },
  sidebar: {
    avatarSize: "h-20 w-20 text-xl",
    editButtonSize: "h-7 w-7",
    editIconSize: "h-3.5 w-3.5",
    layout: "column",
    wrapper:
      "flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/80 px-3 py-4",
    hint: "max-w-[11rem] text-center text-[11px] leading-snug text-neutral-500",
    error: "text-center text-xs text-red-600",
  },
  header: {
    avatarSize: "h-16 w-16 text-xl",
    editButtonSize: "h-6 w-6",
    editIconSize: "h-3 w-3",
    layout: "row",
    wrapper: "w-full",
    hint: "min-w-0 flex-1 text-left text-sm leading-snug text-neutral-600",
    error: "mt-1.5 text-sm text-red-600",
  },
};

function photoHint(editable: boolean, hasPhoto: boolean): string {
  if (editable) return "Tap the pencil to update.";
  return hasPhoto ? "This photo appears first on your public profile." : "No profile photo yet.";
}

export function VendorProfilePhotoField({
  firstName,
  lastName,
  profileImageUrl,
  editable = false,
  uploading = false,
  error,
  onUpload,
  variant = "default",
}: VendorProfilePhotoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initials = `${firstName[0] ?? "?"}${lastName[0] ?? ""}`;
  const styles = VARIANT_STYLES[variant];

  const avatar = (
    <div className="relative shrink-0">
      {profileImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profileImageUrl}
          alt="Profile"
          className={`${styles.avatarSize} rounded-full border border-neutral-100 object-cover object-center`}
        />
      ) : (
        <div
          className={`flex ${styles.avatarSize} items-center justify-center rounded-full bg-primary font-semibold text-white`}
        >
          {initials}
        </div>
      )}
      {editable ? (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onUpload) void onUpload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            aria-label="Edit profile photo"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className={`absolute -bottom-1 -right-1 inline-flex ${styles.editButtonSize} items-center justify-center rounded-full border border-neutral-100 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50 disabled:opacity-60`}
          >
            {uploading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <Pencil className={styles.editIconSize} aria-hidden />
            )}
          </button>
        </>
      ) : null}
    </div>
  );
  const hint = <p className={styles.hint}>{photoHint(editable, Boolean(profileImageUrl))}</p>;

  if (styles.layout === "row") {
    return (
      <div className={styles.wrapper}>
        <div className="flex flex-nowrap items-center gap-3">
          {avatar}
          {hint}
        </div>
        {error ? <p className={styles.error}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div className={styles.wrapper}>
      {avatar}
      {hint}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
