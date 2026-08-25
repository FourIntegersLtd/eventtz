import { describe, expect, it } from "vitest";
import { helpCategoryIconVisual, helpMarkdownToHtml } from "@/features/help/helpContent";

describe("helpCategoryIconVisual", () => {
  it("returns brand-colored shells for known icon keys", () => {
    expect(helpCategoryIconVisual("book").shell).toContain("bg-primary-soft");
    expect(helpCategoryIconVisual("book").icon).toBe("text-primary");
    expect(helpCategoryIconVisual("sparkles").icon).toBe("text-accent-violet");
  });

  it("falls back for unknown icon keys", () => {
    expect(helpCategoryIconVisual("unknown").shell).toContain("bg-primary-soft");
    expect(helpCategoryIconVisual("unknown").icon).toBe("text-primary");
  });
});

describe("helpMarkdownToHtml", () => {
  it("renders NOTE callouts with help-callout classes and SVG icon", () => {
    const html = helpMarkdownToHtml(
      "> [!NOTE]\n> Only you can delete your own account.",
    );
    expect(html).toContain("help-callout--note");
    expect(html).toContain("border-sky-200");
    expect(html).toContain("bg-sky-50");
    expect(html).toContain("Only you can delete your own account.");
    expect(html).toContain('role="note"');
    expect(html).toContain("<svg");
  });

  it("renders WARNING callouts with bold text", () => {
    const html = helpMarkdownToHtml(
      "> [!WARNING]\n> This cannot be undone. **Export** first.",
    );
    expect(html).toContain("help-callout--warning");
    expect(html).toContain("bg-orange-50");
    expect(html).toContain("<strong>Export</strong>");
    expect(html).toContain("This cannot be undone.");
    expect(html).toContain("<svg");
  });

  it("renders IMPORTANT callouts", () => {
    const html = helpMarkdownToHtml(
      "> [!IMPORTANT]\n> Do not confirm if something went wrong.",
    );
    expect(html).toContain("help-callout--important");
    expect(html).toContain("bg-red-50");
    expect(html).toContain("border-red-200");
    expect(html).toContain("Do not confirm if something went wrong.");
  });

  it("renders numbered step headings", () => {
    const html = helpMarkdownToHtml("### 1. Open Settings\n\nFrom the sidebar.");
    expect(html).toContain(">1</span>");
    expect(html).toContain("Open Settings");
    expect(html).toContain("From the sidebar.");
    expect(html).not.toContain("### 1.");
  });

  it("still renders plain headings, lists, and bold", () => {
    const html = helpMarkdownToHtml(
      "## Before you start\n\n- **Upgrading.** You are charged a prorated amount.\n\nKeep going.",
    );
    expect(html).toContain("<h2");
    expect(html).toContain("Before you start");
    expect(html).toContain("<ul");
    expect(html).toContain('<span class="help-list-label');
    expect(html).toContain("Upgrading.");
    expect(html).toContain("Keep going.");
  });

  it("styles label bullets with colon", () => {
    const html = helpMarkdownToHtml(
      "- **Contact:** account problems or payment failures.",
    );
    expect(html).toContain('help-list-label');
    expect(html).toContain("Contact:");
    expect(html).toContain("account problems or payment failures.");
  });

  it("renders callouts at the bottom of the article body", () => {
    const html = helpMarkdownToHtml(
      "Intro paragraph.\n\n> [!NOTE]\n> Remember to save.\n\n## Next steps\n\nDo this next.",
    );
    const noteIndex = html.indexOf("help-callout--note");
    const nextStepsIndex = html.indexOf("Next steps");
    expect(noteIndex).toBeGreaterThan(nextStepsIndex);
    expect(html).toContain("Remember to save.");
  });

  it("escapes raw HTML in article bodies", () => {
    const html = helpMarkdownToHtml("Hello <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
