import { Suspense } from "react";
import { VerifyEmailView } from "@/domains/auth/VerifyEmailView";

/** `/verify-email` — thin route wrapper. `VerifyEmailView` reads `useSearchParams`, so it needs a Suspense boundary. */
export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailView />
    </Suspense>
  );
}
