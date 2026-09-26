import { Suspense } from "react";
import { ResetPasswordView } from "@/domains/auth/ResetPasswordView";

/** `/reset-password` — thin route wrapper. `ResetPasswordView` reads `useSearchParams`, so it needs a Suspense boundary. */
export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordView />
    </Suspense>
  );
}
