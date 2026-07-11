import { redirect } from "next/navigation";

export default function VendorOnboardingRedirectPage() {
  redirect("/vendor/profile");
}
