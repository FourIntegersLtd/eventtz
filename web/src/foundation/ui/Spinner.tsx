/** A small inline loading indicator with an accessible label. */
export function Spinner({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-neutral-500">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-primary-border border-t-primary"
      />
      <span>{label}</span>
    </div>
  );
}
