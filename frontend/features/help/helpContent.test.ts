import { describe, expect, it } from "vitest";
import { helpMarkdownToHtml } from "@/features/help/helpContent";

describe("helpMarkdownToHtml", () => {
  it("renders NOTE callouts", () => {
    const html = helpMarkdownToHtml(
      "> [!NOTE]\n> Only you can delete your own account.",
    );
    expect(html).toContain("bg-sky-50");
    expect(html).toContain("Only you can delete your own account.");
    expect(html).toContain('role="note"');
  });

  it("renders WARNING callouts with bold text", () => {
    const html = helpMarkdownToHtml(
      "> [!WARNING]\n> This cannot be undone. **Export** first.",
    );
    expect(html).toContain("bg-orange-50");
    expect(html).toContain("<strong>Export</strong>");
    expect(html).toContain("This cannot be undone.");
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
    expect(html).toContain("<strong>Upgrading.</strong>");
    expect(html).toContain("Keep going.");
  });

  it("escapes raw HTML in article bodies", () => {
    const html = helpMarkdownToHtml("Hello <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
