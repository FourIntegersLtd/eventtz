import { redirect } from "next/navigation";

export default function AdminFinancialsRedirectPage() {
  redirect("/admin/commerce?tab=financials");
}
