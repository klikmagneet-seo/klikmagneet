"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface RichTextEditorHandle {
  getHTML: () => string;
  setHTML: (html: string) => void;
}

interface Props {
  initialContent?: string;
  onChange?: (html: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(
  ({ initialContent = "", onChange, disabled = false, placeholder, className = "" }, ref) => {
    const editor = useEditor({
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Underline,
      ],
      content: initialContent,
      editable: !disabled,
      onUpdate: ({ editor }) => {
        onChange?.(editor.getHTML());
      },
    });

    useImperativeHandle(
      ref,
      () => ({
        getHTML: () => editor?.getHTML() ?? "",
        setHTML: (html: string) => {
          editor?.commands.setContent(html);
        },
      }),
      [editor]
    );

    useEffect(() => {
      editor?.setEditable(!disabled);
    }, [editor, disabled]);

    // Sync external content changes (import, streaming completion) into the editor.
    // Only fires when `initialContent` actually changes, not on every re-render.
    const prevContent = useRef(initialContent);
    useEffect(() => {
      if (!editor || initialContent === prevContent.current) return;
      prevContent.current = initialContent;
      editor.commands.setContent(initialContent);
    }, [editor, initialContent]);

    if (!editor) return null;

    return (
      <div
        className={`border border-gray-200 rounded-xl bg-white flex flex-col overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 ${className}`}
      >
        {/* Toolbar */}
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-200 bg-gray-50 flex-shrink-0 flex-wrap">
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().setParagraph().run()}
            active={editor.isActive("paragraph") && !editor.isActive("heading")}
            title="Normaal tekst"
          >
            <span className="text-xs font-normal">Tekst</span>
          </ToolbarBtn>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            active={editor.isActive("heading", { level: 1 })}
            title="Kop 1"
          >
            H1
          </ToolbarBtn>
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            active={editor.isActive("heading", { level: 2 })}
            title="Kop 2"
          >
            H2
          </ToolbarBtn>
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            active={editor.isActive("heading", { level: 3 })}
            title="Kop 3"
          >
            H3
          </ToolbarBtn>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleBold().run()}
            active={editor.isActive("bold")}
            title="Dikgedrukt (Ctrl+B)"
          >
            <span className="font-bold">B</span>
          </ToolbarBtn>
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleItalic().run()}
            active={editor.isActive("italic")}
            title="Cursief (Ctrl+I)"
          >
            <span className="italic">I</span>
          </ToolbarBtn>
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleUnderline().run()}
            active={editor.isActive("underline")}
            title="Onderstreept (Ctrl+U)"
          >
            <span className="underline">U</span>
          </ToolbarBtn>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleBulletList().run()}
            active={editor.isActive("bulletList")}
            title="Opsomming"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
          </ToolbarBtn>
          <ToolbarBtn
            onMouseDown={() => editor.chain().focus().toggleOrderedList().run()}
            active={editor.isActive("orderedList")}
            title="Genummerde lijst"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </ToolbarBtn>
        </div>

        {/* Editor */}
        <div className="flex-1 overflow-auto relative">
          {editor.isEmpty && placeholder && (
            <p className="absolute top-4 left-4 text-gray-400 text-sm pointer-events-none select-none">
              {placeholder}
            </p>
          )}
          <EditorContent editor={editor} className="rich-editor h-full" />
        </div>
      </div>
    );
  }
);

RichTextEditor.displayName = "RichTextEditor";
export default RichTextEditor;

function ToolbarBtn({
  onMouseDown,
  active,
  title,
  children,
}: {
  onMouseDown: () => void;
  active: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onMouseDown();
      }}
      title={title}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors min-w-[28px] h-7 flex items-center justify-center ${
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
