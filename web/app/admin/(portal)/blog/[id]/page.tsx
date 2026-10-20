"use client";

import { use, useCallback, useState, type ReactNode } from "react";
import { AdminConsolePage } from "@/features/admin/layout/AdminConsolePage";
import {
  AdminBlogEditorView,
  type AdminBlogEditorPageHead,
} from "@/features/admin/blog/AdminBlogEditorView";

export default function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [title, setTitle] = useState("Edit post");
  const [description, setDescription] = useState<string | undefined>();
  const [actions, setActions] = useState<ReactNode | null>(null);

  const registerHead = useCallback((head: AdminBlogEditorPageHead) => {
    if (head.title) setTitle(head.title);
    setDescription(head.description);
    setActions(head.actions ?? null);
  }, []);

  return (
    <AdminConsolePage title={title} description={description} actions={actions}>
      <AdminBlogEditorView postId={id} onRegisterPageHead={registerHead} />
    </AdminConsolePage>
  );
}
