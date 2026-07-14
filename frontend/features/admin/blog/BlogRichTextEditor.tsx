"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Blockquote } from "@tiptap/extension-blockquote";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { useRef } from "react";
import { uploadImage } from "@/lib/mediaApi";

type BlogEditorProps = {
  initialJson: Record<string, unknown> | null;
  onChange: (payload: { json: Record<string, unknown>; html: string }) => void;
};

const EMPTY_DOC: Record<string, unknown> = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function normalizeDoc(json: Record<string, unknown> | null): Record<string, unknown> {
  if (!json || json.type !== "doc" || !Array.isArray(json.content)) {
    return EMPTY_DOC;
  }
  if (json.content.length === 0) return EMPTY_DOC;
  return json;
}

function ToolbarButton({
  active,
  onAction,
  label,
  children,
}: {
  active?: boolean;
  onAction: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Run on pointerdown + preventDefault so TipTap keeps the cursor position.
      onPointerDown={(e) => {
        e.preventDefault();
        onAction();
      }}
      className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm transition ${
        active ? "bg-primary/15 text-primary" : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {children}
    </button>
  );
}

export function BlogRichTextEditor({ initialJson, onChange }: BlogEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadingRef = useRef(false);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Register list/quote explicitly below (avoids silent StarterKit miss).
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
      Image.configure({ allowBase64: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: "Write here… Highlight a line, then click H1 / list / quote.",
      }),
    ],
    content: normalizeDoc(initialJson),
    editorProps: {
      attributes: {
        class:
          "prose-blog min-h-[22rem] max-w-none px-1 py-2 text-left text-[1.05rem] leading-relaxed text-neutral-900 outline-none focus:outline-none",
      },
    },
    onCreate: ({ editor: ed }) => {
      onChange({
        json: ed.getJSON() as Record<string, unknown>,
        html: ed.getHTML(),
      });
    },
    onUpdate: ({ editor: ed }) => {
      onChange({
        json: ed.getJSON() as Record<string, unknown>,
        html: ed.getHTML(),
      });
    },
  });

  const insertImage = async (file: File) => {
    if (!editor || uploadingRef.current) return;
    uploadingRef.current = true;
    try {
      const uploaded = await uploadImage(file);
      editor.chain().focus().setImage({ src: uploaded.public_url }).run();
    } finally {
      uploadingRef.current = false;
    }
  };

  if (!editor) return null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white text-left">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-100 px-2 py-1.5">
        <ToolbarButton
          label="Heading 1"
          active={editor.isActive("heading", { level: 1 })}
          onAction={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          onAction={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          onAction={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          onAction={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          onAction={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          onAction={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet list"
          active={editor.isActive("bulletList")}
          onAction={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered list"
          active={editor.isActive("orderedList")}
          onAction={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Link"
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
        <ToolbarButton label="Image" onAction={() => fileRef.current?.click()}>
          <ImageIcon className="h-4 w-4" />
        </ToolbarButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void insertImage(f);
          }}
        />
      </div>
      <p className="border-b border-neutral-100 px-3 py-1.5 text-xs text-neutral-500">
        Tip: click in a line, then Quote / Bullet / Number. Or type{" "}
        <kbd className="rounded bg-neutral-100 px-1">-</kbd> then space for a bullet list.
      </p>
      <div className="px-4 py-3 text-left">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
