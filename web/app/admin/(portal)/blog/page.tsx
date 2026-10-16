"use client";

import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminBlogListView } from "@/features/admin/blog/AdminBlogListView";

export default function AdminBlogPage() {
  return (
    <AdminConsolePage title="Blog">
      <AdminBlogListView />
    </AdminConsolePage>
  );
}
