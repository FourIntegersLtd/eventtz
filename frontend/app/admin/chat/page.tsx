import { redirect } from "next/navigation";

export default function AdminChatRedirectPage() {
  redirect("/admin/trust?tab=chat");
}
