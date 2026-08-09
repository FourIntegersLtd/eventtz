"use client";

import { useRef } from "react";
import { Pencil } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export type VendorProfilePhotoFieldProps = {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  editable?: boolean;
  uploading?: boolean;
  error?: string | null;
  onUpload?: (file: File) => void | Promise<void>;
  /** Compact layout for the profile sidebar. */
  variant?: "default" | "sidebar" | "tabs" | "header";
};

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
  const sizeClass =
    variant === "header"
      ? "h-16 w-16 text-xl"
      : variant === "tabs"
        ? "h-14 w-14 text-lg"
        : variant === "sidebar"
          ? "h-20 w-20 text-xl"
          : "h-24 w-24 text-2xl";
  const buttonClass =
    variant === "header" || variant === "tabs"
      ? "h-6 w-6"
      : variant === "sidebar"
        ? "h-7 w-7"
        : "h-8 w-8";

  const avatarBlock = (
    <div className="relative shrink-0">
        {profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profileImageUrl}
            alt="Profile"
            className={`${sizeClass} rounded-full border border-neutral-100 object-cover object-center`}
          />
        ) : (
          <div
            className={`flex ${sizeClass} items-center justify-center rounded-full bg-primary font-semibold text-white`}
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
              className={`absolute -bottom-1 -right-1 inline-flex ${buttonClass} items-center justify-center rounded-full border border-neutral-100 bg-white text-neutral-600 shadow-sm hover:bg-neutral-50 disabled:opacity-60`}
            >
              {uploading ? (
                <LoadingSpinner size="sm" />
              ) : (
                <Pencil className={variant === "tabs" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
              )}
            </button>
          </>
        ) : null}
      </div>
  );

  if (variant === "header") {
    const hintText = editable
      ? "Tap the pencil to update your public profile photo."
      : profileImageUrl
        ? "This photo appears on your public profile."
        : "No profile photo yet.";

    return (
      <div className="w-full">
        <div className="flex flex-nowrap items-center gap-3">
          {avatarBlock}
          <p className="min-w-0 flex-1 text-sm leading-snug text-neutral-600">{hintText}</p>
        </div>
        {error ? <p className="mt-1.5 text-sm text-red-600">{error}</p> : null}
      </div>
    );
  }

  const wrapperClass =
    variant === "tabs"
      ? "flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-3"
      : variant === "sidebar"
        ? "flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/80 px-3 py-4"
        : "flex flex-col items-center gap-2";

  const hintClass =
    variant === "tabs"
      ? "min-w-0 flex-1 text-left text-[11px] leading-snug text-neutral-500"
      : variant === "sidebar"
        ? "max-w-[11rem] text-center text-[11px] leading-snug text-neutral-500"
        : "max-w-xs text-center text-xs text-neutral-500";

  const hintText = editable
    ? variant === "tabs"
      ? "Tap the pencil to upload or change your public profile photo."
      : "This photo appears first on your public profile. Tap the pencil to upload or change it."
    : profileImageUrl
      ? "This photo appears first on your public profile."
      : "No profile photo yet.";

  return (
    <div className={wrapperClass}>
      {avatarBlock}
      <p className={hintClass}>{hintText}</p>
      {error ? (
        <p
          className={
            variant === "tabs"
              ? "w-full text-left text-xs text-red-600"
              : "text-center text-xs text-red-600"
          }
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
