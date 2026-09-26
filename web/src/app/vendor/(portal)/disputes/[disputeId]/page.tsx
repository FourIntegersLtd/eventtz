import { DisputeDetailView } from "@/domains/vendor-disputes/DisputeDetailView";

type PageProps = {
  params: Promise<{ disputeId: string }>;
};

/** `/vendor/disputes/[disputeId]` — one dispute's full detail. */
export default async function VendorDisputeDetailPage({ params }: PageProps) {
  const { disputeId } = await params;
  return <DisputeDetailView key={disputeId} disputeId={disputeId} />;
}
