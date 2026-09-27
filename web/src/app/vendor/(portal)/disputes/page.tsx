import { DisputesListView } from "@/domains/disputes/DisputesListView";

/** `/vendor/disputes` — every dispute the vendor is party to. */
export default function VendorDisputesPage() {
  return <DisputesListView role="vendor" />;
}
