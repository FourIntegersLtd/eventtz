"use client";

import { Suspense } from "react";
import { AuthRouteRedirect } from "@/features/auth/AuthRouteRedirect";

export default function ClientLoginPage() {
  return (
    <Suspense>
      <AuthRouteRedirect to="/login" />
    </Suspense>
  );
}
