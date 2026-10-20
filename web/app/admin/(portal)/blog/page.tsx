"use client";

import { useCallback, useState, type ReactNode } from "react";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import {
  AdminBlogListView,
  type AdminBlogListPageHead,
} from "@/features/admin/blog/AdminBlogListView";

export default function AdminBlogPage() {
  const [description, setDescription] = useState<string | undefined>();
  const [actions, setActions] = useState<ReactNode | null>(null);

  const registerHead = useCallback((head: AdminBlogListPageHead) => {
    setDescription(head.description);
    setActions(head.actions ?? null);
  }, []);

  return (
    <AdminConsolePage title="Blog" description={description} actions={actions}>
      <AdminBlogListView onRegisterPageHead={registerHead} />
    </AdminConsolePage>
  );
}
