import { redirect } from "next/navigation";

export default function AdminVendorsRedirectPage() {
  redirect("/admin/directory?tab=vendors");
}
