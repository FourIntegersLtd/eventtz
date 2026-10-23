"use client";

type AdminErrorBannerProps = {
  message: string;
  onRetry?: () => void;
};

/** Inline error for admin screens (design: `ez-banner ez-banner--danger`). */
export function AdminErrorBanner({ message, onRetry }: AdminErrorBannerProps) {
  return (
    <div className="ez-banner ez-banner--danger" role="alert">
      <div className="ez-banner__body">
        <div className="ez-banner__title">{message}</div>
        {onRetry ? (
          <button type="button" className="ez-btn ez-btn--secondary ez-btn--sm" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    </div>
  );
}
