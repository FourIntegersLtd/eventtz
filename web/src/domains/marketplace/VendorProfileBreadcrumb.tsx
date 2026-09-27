/**
 * Mobile trail back to browse: Home, category, vendor name.
 */
import Link from "next/link";
import { vendorBrowseCategoryLabel } from "./browseLabels";

export { vendorBrowseCategoryLabel };

type VendorProfileBreadcrumbProps = {
  browseHref: string;
  categoryHref: string;
  categoryLabel: string;
  vendorName: string;
  className?: string;
};

/** Home › category › vendor. Keeps the marketplace search on each link. */
export function VendorProfileBreadcrumb({
  browseHref,
  categoryHref,
  categoryLabel,
  vendorName,
  className = "",
}: VendorProfileBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`text-sm text-neutral-600 ${className}`.trim()}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <li>
          <Link href={browseHref} className="hover:text-neutral-900">
            Home
          </Link>
        </li>
        <li aria-hidden className="text-neutral-400">
          ›
        </li>
        <li>
          <Link href={categoryHref} className="hover:text-neutral-900">
            {categoryLabel}
          </Link>
        </li>
        <li aria-hidden className="text-neutral-400">
          ›
        </li>
        <li className="min-w-0 truncate font-medium text-neutral-900">{vendorName}</li>
      </ol>
    </nav>
  );
}
