import Link from "next/link";
import { LottieIllustration } from "@/components/ui/LottieIllustration";
import { getButtonClassName } from "@/components/ui/buttonStyles";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <LottieIllustration asset="notFound" className="h-40 w-40 sm:h-48 sm:w-48" />
      <h1 className="font-heading mt-6 text-2xl font-semibold text-neutral-900">Page not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-neutral-600">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>
      <Link href="/" className={getButtonClassName({ className: "mt-8 px-6 py-3" })}>
        Back to home
      </Link>
    </main>
  );
}
