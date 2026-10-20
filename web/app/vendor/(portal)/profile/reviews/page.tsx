import { redirect } from "next/navigation";

/** Reviews stay on the profile page, in the same tab row as Details. */
export default function VendorProfileReviewsPage() {
  redirect("/vendor/profile?tab=reviews");
}
