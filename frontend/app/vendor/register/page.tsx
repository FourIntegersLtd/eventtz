"use client";

import { Suspense } from "react";
import { AuthRouteRedirect } from "@/features/auth/AuthRouteRedirect";

export default function VendorRegisterPage() {
  return (
    <Suspense>
      <AuthRouteRedirect to="/register" forceParams={{ type: "vendor" }} />
    </Suspense>
  );
}
