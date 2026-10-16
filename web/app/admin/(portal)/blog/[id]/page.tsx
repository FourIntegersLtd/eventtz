"use client";

import { use } from "react";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import { AdminBlogEditorView } from "@/features/admin/blog/AdminBlogEditorView";

export default function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AdminConsolePage title="Edit post">
      <AdminBlogEditorView postId={id} />
    </AdminConsolePage>
  );
}
