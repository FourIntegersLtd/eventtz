import { AdminShell } from "@/capabilities/admin-shell";
import { AdminBlogEditorView } from "@/domains/admin-blog/AdminBlogEditorView";

/** `/admin/blog/[id]` — thin route wrapper. */
export default async function AdminBlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AdminShell title="Edit post">
      <AdminBlogEditorView postId={id} />
    </AdminShell>
  );
}
