"use client";

type VendorPortfolioThumbGridProps = {
  urls: string[];
  className?: string;
  thumbClassName?: string;
};

export function VendorPortfolioThumbGrid({
  urls,
  className = "mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4",
  thumbClassName = "aspect-[4/3] w-full rounded-lg bg-neutral-50 object-contain object-center ring-1 ring-neutral-200/80",
}: VendorPortfolioThumbGridProps) {
  if (urls.length === 0) return null;

  return (
    <div className={className}>
      {urls.map((url, index) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          key={url}
          src={url}
          alt={`Portfolio photo ${index + 1}`}
          className={thumbClassName}
        />
      ))}
    </div>
  );
}
