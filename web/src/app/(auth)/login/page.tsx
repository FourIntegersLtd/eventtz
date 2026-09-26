import { Suspense } from "react";
import { LoginView } from "@/domains/auth/LoginView";

/** `/login` — thin route wrapper. `LoginView` reads `useSearchParams`, so it needs a Suspense boundary. */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  );
}
