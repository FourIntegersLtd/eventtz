import { HomeView } from "@/domains/marketing/HomeView";
import { MarketingShell } from "@/domains/marketing/MarketingShell";

/** `/` — the home page. */
export default function HomePage() {
  return (
    <MarketingShell>
      <HomeView />
    </MarketingShell>
  );
}
