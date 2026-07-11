import { redirect } from "next/navigation";

export default function AdminBookingsRedirectPage() {
  redirect("/admin/commerce?tab=bookings");
}
