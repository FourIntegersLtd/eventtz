import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "@/components/ui/Modal";

vi.stubGlobal("document", { body: {} });

// Render the open dialog in place: no portal, already mounted, effects and motion stripped.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  useState: () => [true, () => {}],
  useEffect: () => {},
}));
vi.mock("react-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-dom")>()),
  createPortal: (node: unknown) => node,
}));
vi.mock("@/lib/usePrefersReducedMotion", () => ({ usePrefersReducedMotion: () => true }));
vi.mock("motion/react", async () => {
  const React = await import("react");
  const strip = (tag: string) => {
    function Stripped(props: Record<string, unknown>) {
      const { initial, animate, exit, transition, ...rest } = props;
      void [initial, animate, exit, transition];
      return React.createElement(tag, rest);
    }
    return Stripped;
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { button: strip("button"), div: strip("div") },
  };
});

const render = (props: Partial<React.ComponentProps<typeof Modal>> = {}) =>
  renderToStaticMarkup(
    <Modal isOpen onClose={() => {}} title="Edit thing" footer={<span>Foot</span>} {...props}>
      <p>Body</p>
    </Modal>,
  );

describe("Modal", () => {
  it("keeps its default look and title bar", () => {
    const html = render();
    expect(html).toContain("rounded-card bg-white shadow-overlay max-h-[min(90dvh,720px)]");
    expect(html).toContain("bg-page-bg px-4 py-4 sm:px-5 sm:py-5");
    expect(html).toContain("items-center justify-center p-4 sm:p-6");
    expect(html).toContain('class="absolute inset-0 bg-scrim"');
    expect(html).toContain('aria-labelledby="modal-title"');
    expect(html).toContain(">Edit thing</h2>");
  });

  it("swaps the title bar and look when the caller passes overrides", () => {
    const html = render({
      header: <div>Custom header</div>,
      panelClassName: "rounded-t-3xl bg-surface",
      bodyPaddingClassName: "px-5",
      footerClassName: "border-t px-5",
      scrimClassName: "bg-black/55",
      positionClassName: "items-end",
    });
    expect(html).toContain("Custom header");
    expect(html).not.toContain(">Edit thing</h2>");
    expect(html).toContain('aria-label="Edit thing"');
    expect(html).not.toContain("aria-labelledby");
    expect(html).toContain("rounded-t-3xl bg-surface");
    expect(html).not.toContain("shadow-overlay");
    expect(html).not.toContain("bg-page-bg");
    expect(html).toContain("shrink-0 border-t px-5");
    expect(html).toContain("absolute inset-0 bg-black/55");
    expect(html).toContain("items-end");
  });
});
