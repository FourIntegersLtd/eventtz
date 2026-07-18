import { redirect } from "next/navigation";

/** Help lives in the portal FAB widget — keep URL for bookmarks. */
export default function ClientHelpPage() {
  redirect("/client/dashboard");
}
