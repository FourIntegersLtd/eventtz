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
  variant?: "default" | "sidebar";
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
  const sizeClass = variant === "sidebar" ? "h-20 w-20 text-xl" : "h-24 w-24 text-2xl";
  const buttonClass =
    variant === "sidebar" ? "h-7 w-7" : "h-8 w-8";

  return (
    <div
      className={
        variant === "sidebar"
          ? "flex flex-col items-center gap-2 rounded-2xl border border-neutral-100 bg-neutral-50/80 px-3 py-4"
          : "flex flex-col items-center gap-2"
      }
    >
      <div className="relative">
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
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              )}
            </button>
          </>
        ) : null}
      </div>
      <p
        className={`text-center text-neutral-500 ${
          variant === "sidebar" ? "max-w-[11rem] text-[11px] leading-snug" : "max-w-xs text-xs"
        }`}
      >
        {editable
          ? "This photo appears first on your public profile. Tap the pencil to upload or change it."
          : profileImageUrl
            ? "This photo appears first on your public profile."
            : "No profile photo yet."}
      </p>
      {error ? <p className="text-center text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
