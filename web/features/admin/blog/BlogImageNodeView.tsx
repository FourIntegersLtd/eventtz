"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { X } from "lucide-react";

export function BlogImageNodeView({ node, deleteNode, selected }: NodeViewProps) {
  const src = typeof node.attrs.src === "string" ? node.attrs.src : "";
  const alt = typeof node.attrs.alt === "string" ? node.attrs.alt : "";

  return (
    <NodeViewWrapper
      as="div"
      className={`blog-image-block group relative mx-auto my-3 w-fit max-w-[75%] sm:max-w-[78%] ${
        selected ? "rounded-lg ring-2 ring-neutral-300" : ""
      }`}
      data-drag-handle
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        className="block h-auto max-h-64 w-auto max-w-full rounded-lg object-contain sm:max-h-80"
      />
      <button
        type="button"
        aria-label="Remove image"
        contentEditable={false}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          deleteNode();
        }}
        className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-red-50 hover:text-red-600"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </NodeViewWrapper>
  );
}
