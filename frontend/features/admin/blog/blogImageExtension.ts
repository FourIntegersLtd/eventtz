import Image from "@tiptap/extension-image";
import { mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { BlogImageNodeView } from "@/features/admin/blog/BlogImageNodeView";

function captionFromFigure(node: HTMLElement): string | null {
  const cap = node.querySelector("figcaption");
  const text = cap?.textContent?.trim();
  return text || null;
}

/** Blog body images — optional caption (figure/figcaption), alt text, lazy loading. */
export const BlogImage = Image.extend({
  draggable: true,

  addNodeView() {
    return ReactNodeViewRenderer(BlogImageNodeView);
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: null,
        parseHTML: (element) => element.getAttribute("alt"),
        renderHTML: (attributes) =>
          attributes.alt ? { alt: String(attributes.alt) } : {},
      },
      caption: {
        default: null,
        parseHTML: (element) => {
          if (element.tagName.toLowerCase() === "figure") {
            return captionFromFigure(element);
          }
          const figure = element.closest("figure");
          return figure ? captionFromFigure(figure) : null;
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "figure",
        getAttrs: (node) => {
          const el = node as HTMLElement;
          const img = el.querySelector("img");
          if (!img) return false;
          const src = img.getAttribute("src");
          if (!src) return false;
          return {
            src,
            alt: img.getAttribute("alt"),
            caption: captionFromFigure(el),
          };
        },
      },
      {
        tag: 'img[src]:not([src^="data:"])',
        getAttrs: (node) => {
          const el = node as HTMLElement;
          return {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt"),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const caption =
      typeof HTMLAttributes.caption === "string" ? HTMLAttributes.caption.trim() : "";
    const { caption: _drop, ...imgAttrs } = HTMLAttributes;

    if (caption) {
      return [
        "figure",
        { class: "blog-figure" },
        ["img", mergeAttributes(imgAttrs, { loading: "lazy" })],
        ["figcaption", {}, caption],
      ];
    }

    return ["img", mergeAttributes(imgAttrs, { loading: "lazy" })];
  },
});
