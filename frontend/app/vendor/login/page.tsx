"use client";

import { Suspense } from "react";
import { AuthRouteRedirect } from "@/features/auth/AuthRouteRedirect";

export default function VendorLoginPage() {
  return (
    <Suspense>
      <AuthRouteRedirect to="/login" />
    </Suspense>
  );
}
