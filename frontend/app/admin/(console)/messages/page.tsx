"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminSectionTabs } from "@/features/admin/layout/AdminSectionTabs";
import { AdminLoadingState } from "@/features/admin/components/AdminLoadingState";
import { AdminPageHeader } from "@/features/admin/components/AdminPageHeader";
import { AdminMessagesComposeView } from "@/features/admin/messages/AdminMessagesComposeView";
import { AdminMessagesInboxView } from "@/features/admin/messages/AdminMessagesInboxView";
import { fetchAdminSupportConversations } from "@/lib/adminMessagesApi";
import { useRealtimeRefresh } from "@/lib/realtimeHooks";

const TABS = [
  { id: "inbox", label: "Inbox" },
  { id: "compose", label: "Compose" },
] as const;

function MessagesTabs() {
  const searchParams = useSearchParams();
  const tab = useMemo((): "inbox" | "compose" => {
    const t = searchParams.get("tab");
    return t === "compose" ? "compose" : "inbox";
  }, [searchParams]);

  const [inboxUnread, setInboxUnread] = useState(0);

  const refreshUnreadBadge = useCallback(async () => {
    try {
      const list = await fetchAdminSupportConversations();
      setInboxUnread(list.reduce((sum, c) => sum + (c.unread_count || 0), 0));
    } catch {
      /* badge is best-effort */
    }
  }, []);

  useEffect(() => {
    void refreshUnreadBadge();
  }, [refreshUnreadBadge, tab]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshUnreadBadge();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [refreshUnreadBadge]);

  useRealtimeRefresh("chat:data_refresh", () => void refreshUnreadBadge(), [refreshUnreadBadge]);

  const tabs = useMemo(
    () =>
      TABS.map((t) =>
        t.id === "inbox" && inboxUnread > 0 ? { ...t, badge: inboxUnread } : { ...t },
      ),
    [inboxUnread],
  );

  return (
    <>
      <AdminPageHeader />
      <AdminSectionTabs tabs={tabs} activeId={tab} basePath="/admin/messages" />
      {tab === "compose" ? (
        <AdminMessagesComposeView />
      ) : (
        <AdminMessagesInboxView onUnreadTotalChange={setInboxUnread} />
      )}
    </>
  );
}

export default function AdminMessagesPage() {
  return (
    <AdminConsolePage title="Messages">
      <Suspense fallback={<AdminLoadingState />}>
        <MessagesTabs />
      </Suspense>
    </AdminConsolePage>
  );
}
