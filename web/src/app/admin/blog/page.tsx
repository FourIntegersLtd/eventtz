import { AdminShell } from "@/capabilities/admin-shell";
import { AdminBlogListView } from "@/domains/admin-blog/AdminBlogListView";

/** `/admin/blog` — thin route wrapper. */
export default function AdminBlogPage() {
  return (
    <AdminShell title="Blog">
      <AdminBlogListView />
    </AdminShell>
  );
}
