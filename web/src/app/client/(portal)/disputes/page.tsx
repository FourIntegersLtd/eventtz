import { DisputesListView } from "@/domains/disputes/DisputesListView";

/** `/client/disputes` — every dispute the client is party to. */
export default function ClientDisputesPage() {
  return <DisputesListView role="client" />;
}
