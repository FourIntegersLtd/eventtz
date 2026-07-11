import { redirect } from "next/navigation";

export default function AdminReviewsRedirectPage() {
  redirect("/admin/trust?tab=reviews");
}
