import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TextArea } from "@/components/ui/TextArea";

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useId: () => "generated-id",
}));

/** Finds the first element in a rendered tree whose props satisfy `matches`. */
function findElement(node: ReactNode, matches: (props: Record<string, unknown>) => boolean): ReactElement | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, matches);
      if (found) return found;
    }
    return null;
  }
  const element = node as ReactElement<{ children?: ReactNode } & Record<string, unknown>>;
  if (matches(element.props)) return element;
  return findElement(element.props?.children, matches);
}

describe("TextArea clear button", () => {
  it("calls onClear when the clear button is clicked", () => {
    const onClear = vi.fn();
    // forwardRef components expose `render`, so the tree can be read without a DOM.
    const tree = (TextArea as unknown as { render: (props: object, ref: null) => ReactNode }).render(
      { label: "Public bio", value: "A long bio", onChange: () => {}, onClear },
      null,
    );
    const button = findElement(tree, (props) => props["aria-label"] === "Clear");
    expect(button).not.toBeNull();
    (button!.props as { onClick: () => void }).onClick();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows the clear button only while there is a value", () => {
    const withValue = renderToStaticMarkup(<TextArea label="Bio" value="x" onChange={() => {}} onClear={() => {}} />);
    const empty = renderToStaticMarkup(<TextArea label="Bio" value="" onChange={() => {}} onClear={() => {}} />);
    expect(withValue).toContain('aria-label="Clear"');
    expect(empty).not.toContain('aria-label="Clear"');
  });

  it("has no clear button without onClear", () => {
    expect(renderToStaticMarkup(<TextArea label="Bio" value="x" onChange={() => {}} />)).not.toContain("Clear");
  });
});
