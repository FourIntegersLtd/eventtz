"use client";

type ExamplePromptChipsProps = {
  examples: readonly string[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
  /** Max chips shown; defaults to all. */
  limit?: number;
  className?: string;
};

export function ExamplePromptChips({
  examples,
  onSelect,
  disabled = false,
  limit,
  className = "",
}: ExamplePromptChipsProps) {
  const shown = limit != null ? examples.slice(0, limit) : examples;
  if (shown.length === 0) return null;

  return (
    <div className={`flex flex-wrap justify-center gap-2 ${className}`}>
      {shown.map((prompt) => (
        <button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-neutral-700 transition hover:border-primary/30 hover:bg-primary/[0.04] hover:text-neutral-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
