"use client";

import { ClientDashboardView } from "@/domains/client-dashboard/ClientDashboardView";

/** `/client/dashboard` — the client's home screen. Auth/shell wiring is in the portal layout. */
export default function ClientDashboardPage() {
  return <ClientDashboardView />;
}
