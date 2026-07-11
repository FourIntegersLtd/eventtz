"use client";

import { Suspense } from "react";
import { AuthRouteRedirect } from "@/features/auth/AuthRouteRedirect";

export default function ClientRegisterPage() {
  return (
    <Suspense>
      <AuthRouteRedirect to="/register" forceParams={{ type: "client" }} />
    </Suspense>
  );
}
