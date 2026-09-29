import { ToastProvider } from "@/foundation/ui/Toast";
import { VendorOnboarding } from "@/domains/vendor-onboarding/VendorOnboarding";

/** `/vendor/profile` is the vendor onboarding wizard. */
export default function VendorProfilePage() {
  return (
    <ToastProvider>
      <VendorOnboarding />
    </ToastProvider>
  );
}
