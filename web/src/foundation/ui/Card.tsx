import { clsx } from "clsx";
import type { ReactNode } from "react";

/** A rounded, shadowed content panel — the shared shell for auth forms and marketing cards. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-2xl bg-white p-6 shadow-lg shadow-primary/5 ring-1 ring-primary-border", className)}>
      {children}
    </div>
  );
}
