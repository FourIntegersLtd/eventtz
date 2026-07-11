import type { ReactNode } from "react";
import { EventtzLogo } from "@/components/branding/EventtzLogo";

type AuthPageShellProps = {
  children: ReactNode;
  logoHref: string;
};

export function AuthPageShell({ children, logoHref }: AuthPageShellProps) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f5f2f8]">
      {/* Soft branded gradient + blurred blobs so the auth pages don't read as a bare form on a flat tint. */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#f5f2f8] via-[#efe7f6] to-[#e4d9f2]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-16 top-1/3 h-96 w-96 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-[-6rem] left-1/3 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl"
        aria-hidden
      />

      <header className="relative z-10 border-b border-slate-200/60 bg-white/40 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-12">
        <EventtzLogo priority href={logoHref} />
      </header>
      <div className="relative z-10 flex items-center justify-center px-4 py-10 sm:py-14">
        {children}
      </div>
    </main>
  );
}
