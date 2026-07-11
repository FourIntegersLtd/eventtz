"use client";

type AdminErrorBannerProps = {
  message: string;
};

export function AdminErrorBanner({ message }: AdminErrorBannerProps) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      {message}
    </div>
  );
}
