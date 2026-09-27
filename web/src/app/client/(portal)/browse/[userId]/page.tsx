import { Suspense } from "react";
import { Spinner } from "@/foundation/ui";
import { VendorProfileRoute } from "./VendorProfileRoute";

type PageProps = {
  params: Promise<{ userId: string }>;
};

/**
 * `/client/browse/[userId]` — public vendor profile.
 * Suspense is required because the view reads search params.
 */
export default async function ClientVendorProfilePage({ params }: PageProps) {
  const { userId } = await params;
  return (
    <Suspense fallback={<Spinner label="Loading vendor…" />}>
      <VendorProfileRoute vendorUserId={userId} />
    </Suspense>
  );
}
