import { Suspense } from "react";
import { RegisterView } from "@/domains/auth/RegisterView";

/** `/register` — thin route wrapper. `RegisterView` reads `useSearchParams`, so it needs a Suspense boundary. */
export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterView />
    </Suspense>
  );
}
