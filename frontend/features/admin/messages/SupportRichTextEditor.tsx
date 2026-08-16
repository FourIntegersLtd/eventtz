"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Blockquote } from "@tiptap/extension-blockquote";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Quote } from "lucide-react";
import { useEffect, useRef } from "react";
import type { Editor } from "@tiptap/core";

export type SupportRichTextChange = {
  html: string;
  textLength: number;
};

/** Load plain-text defaults (e.g. checklist templates) into the support editor. */
export function plainTextToSupportHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "<p></p>";
  const escape = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return trimmed
    .split(/\n{2,}/)
    .map((block) => `<p>${escape(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

type SupportRichTextEditorProps = {
  initialHtml?: string;
  onChange: (payload: SupportRichTextChange) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeightClass?: string;
};

function ToolbarButton({
  active,
  disabled,
  onAction,
  label,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onAction: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onPointerDown={(e) => {
        e.preventDefault();
        if (!disabled) onAction();
      }}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-primary/15 text-primary" : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

export function SupportRichTextEditor({
  initialHtml = "",
  onChange,
  disabled = false,
  placeholder = "Write a support message…",
  minHeightClass = "min-h-[10rem]",
}: SupportRichTextEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const initialContent = initialHtml.trim() || "<p></p>";

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        listKeymap: false,
        blockquote: false,
      }),
      ListItem,
      BulletList.configure({ keepMarks: true }),
      OrderedList.configure({ keepMarks: true }),
      ListKeymap,
      Blockquote,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: `prose-message ${minHeightClass} max-w-none px-1 py-2 text-left text-base leading-relaxed text-neutral-900 outline-none focus:outline-none md:text-sm`,
      },
    },
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
      onChange({ html: ed.getHTML(), textLength: ed.getText().trim().length });
    },
    onUpdate: ({ editor: ed }) => {
      onChange({ html: ed.getHTML(), textLength: ed.getText().trim().length });
    },
  });

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  if (editor && editorRef.current !== editor) {
    editorRef.current = editor;
  }

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 text-left focus-within:border-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-primary/20">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 px-2 py-1.5">
        <ToolbarButton
          label="Bold"
          disabled={disabled}
          active={editor.isActive("bold")}
          onAction={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          disabled={disabled}
          active={editor.isActive("italic")}
          onAction={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          disabled={disabled}
          active={editor.isActive("blockquote")}
          onAction={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          disabled={disabled}
          active={editor.isActive("bulletList")}
          onAction={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          disabled={disabled}
          active={editor.isActive("orderedList")}
          onAction={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
          disabled={disabled}
          active={editor.isActive("link")}
          onAction={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev || "https://");
            if (url === null) return;
            if (!url.trim()) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
          }}
        >
          <LinkIcon className="h-4 w-4" />
        </ToolbarButton>
      </div>
      <div className="px-3 py-2.5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
