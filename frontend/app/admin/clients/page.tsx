import { redirect } from "next/navigation";

export default function AdminClientsRedirectPage() {
  redirect("/admin/directory?tab=clients");
}
