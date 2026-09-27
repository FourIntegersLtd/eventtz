import { DisputeDetailView } from "@/domains/disputes/DisputeDetailView";

type PageProps = {
  params: Promise<{ disputeId: string }>;
};

/** `/client/disputes/[disputeId]` — one dispute's full detail. */
export default async function ClientDisputeDetailPage({ params }: PageProps) {
  const { disputeId } = await params;
  return <DisputeDetailView key={disputeId} role="client" disputeId={disputeId} />;
}
