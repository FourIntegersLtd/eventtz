"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { BulletList, ListItem, ListKeymap, OrderedList } from "@tiptap/extension-list";
import { Blockquote } from "@tiptap/extension-blockquote";
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { uploadImage } from "@/lib/mediaApi";
import { BlogImage } from "@/features/admin/blog/blogImageExtension";

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

function imageFilesFromList(files: FileList | File[]): File[] {
  return Array.from(files).filter((f) => f.type.startsWith("image/"));
}

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

export function BlogRichTextEditor({ initialJson, onChange }: BlogEditorProps) {
  const [uploadingCount, setUploadingCount] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const editorRef = useRef<Editor | null>(null);

  const insertImages = useCallback(async (files: FileList | File[], ed: Editor) => {
    const images = imageFilesFromList(files);
    if (images.length === 0) return;

    setUploadingCount((n) => n + images.length);
    for (const file of images) {
      try {
        const uploaded = await uploadImage(file);
        ed.chain().focus().setImage({ src: uploaded.public_url }).run();
      } catch {
        // Skip failed uploads; admin can retry.
      } finally {
        setUploadingCount((n) => Math.max(0, n - 1));
      }
    }
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
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
      BlogImage.configure({ allowBase64: false, inline: false }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Placeholder.configure({
        placeholder: "Write here…",
      }),
    ],
    content: normalizeDoc(initialJson),
    editorProps: {
      attributes: {
        class:
          "prose-blog min-h-[22rem] max-w-none px-1 py-2 text-left text-[1.05rem] leading-relaxed text-neutral-900 outline-none focus:outline-none",
      },
      handleDrop: (view, event, _slice, moved) => {
        if (moved || !editorRef.current) return false;
        const files = imageFilesFromList(event.dataTransfer?.files ?? []);
        if (files.length === 0) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
        if (pos != null) {
          editorRef.current.chain().focus().setTextSelection(pos).run();
        }
        void insertImages(files, editorRef.current);
        return true;
      },
    },
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
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

  if (editor && editorRef.current !== editor) {
    editorRef.current = editor;
  }

  if (!editor) return null;

  const uploading = uploadingCount > 0;

  return (
    <div className="ez-card overflow-hidden text-left">
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
        {uploading ? (
          <span className="px-2 text-xs text-neutral-500">Uploading image…</span>
        ) : null}
      </div>
      <div
        className={`px-4 py-3 text-left transition ${
          dragOver ? "rounded-lg bg-primary/[0.04] ring-2 ring-primary/20 ring-inset" : ""
        }`}
        onDragEnter={(e) => {
          if (e.dataTransfer?.types.includes("Files")) setDragOver(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
        }}
        onDragOver={(e) => {
          if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
        }}
        onDrop={() => setDragOver(false)}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
