'use client'

/**
 * Tiptap editor for the Lexia Workspace.
 *
 * Exposes imperative handle useful for parent components (save / export).
 * Handles ⌘K: on cmd/ctrl+K the caller is asked to open the popover with
 * the current selection/position.
 */

import { forwardRef, useCallback, useImperativeHandle, useRef } from 'react'
import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import type { Content } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import { PlaceholderInline } from './extensions/placeholder-inline'
import { Citation, type CitationStatus } from './extensions/citation'
import { PendingEdit } from './extensions/pending-edit'
import { CommentMark } from './extensions/comment-mark'
import type { TiptapDoc, Citation as CitationData } from '@/lib/lexia/workspace'

export interface EditorImperativeHandle {
  getJSON: () => TiptapDoc
  getText: () => string
  /** Replace the current selection with structured text (paragraph splits on \n\n). */
  replaceSelectionWithText: (text: string, citations?: CitationData[]) => void
  /** Insert text at a given position (used for 'insert' mode). */
  insertTextAt: (pos: number, text: string, citations?: CitationData[]) => void
  /** Mark a range as "pending edit" (amber highlight while popover open). */
  markPending: (from: number, to: number) => void
  clearPending: () => void
  /** Wrap a range in a commentThread mark with the given threadId. */
  markComment: (from: number, to: number, threadId: string) => void
  /** Remove commentThread mark for all ranges matching threadId. */
  unmarkComment: (threadId: string) => void
  /** Scroll to the first occurrence of a commentThread mark. */
  scrollToComment: (threadId: string) => void
  focus: () => void
  getEditor: () => Editor | null
}

export interface CmdKRequest {
  mode: 'selection' | 'insert'
  from: number
  to: number
  text: string
  anchor: { x: number; y: number }
}

interface WorkspaceEditorProps {
  initialContent: TiptapDoc
  editable?: boolean
  onUpdate?: (doc: TiptapDoc, plainText: string) => void
  onCmdK?: (req: CmdKRequest) => void
}

export const WorkspaceEditor = forwardRef<EditorImperativeHandle, WorkspaceEditorProps>(
  function WorkspaceEditor({ initialContent, editable = true, onUpdate, onCmdK }, ref) {
    const onUpdateRef = useRef(onUpdate)
    onUpdateRef.current = onUpdate
    const onCmdKRef = useRef(onCmdK)
    onCmdKRef.current = onCmdK

    const editor = useEditor({
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3] },
        }),
        Placeholder.configure({
          placeholder: 'Escribí o usá ⌘K…',
        }),
        Typography,
        Underline,
        Highlight,
        Link.configure({ openOnClick: false }),
        PlaceholderInline,
        Citation,
        PendingEdit,
        CommentMark,
      ],
      content: initialContent as unknown as Content,
      editable,
      immediatelyRender: false,
      editorProps: {
        attributes: {
          class: 'lexia-editor focus:outline-none',
          spellcheck: 'false',
        },
        handleKeyDown: (_view, event) => {
          if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) {
            event.preventDefault()
            fireCmdK()
            return true
          }
          return false
        },
      },
      onUpdate: ({ editor }) => {
        onUpdateRef.current?.(editor.getJSON() as TiptapDoc, editor.getText())
      },
    })

    const fireCmdK = useCallback(() => {
      if (!editor) return
      const { from, to, empty } = editor.state.selection
      const text = editor.state.doc.textBetween(from, to, '\n')
      const mode: 'selection' | 'insert' = empty ? 'insert' : 'selection'

      // Anchor at the end of the selection in viewport coords.
      const coords = editor.view.coordsAtPos(empty ? from : to)
      const anchor = computeAnchor({
        x: Math.max(16, coords.left),
        y: coords.bottom + 8,
      })

      onCmdKRef.current?.({ mode, from, to, text, anchor })
    }, [editor])

    useImperativeHandle(ref, () => ({
      getJSON: () => (editor?.getJSON() as TiptapDoc) ?? { type: 'doc', content: [] },
      getText: () => editor?.getText() ?? '',
      focus: () => editor?.commands.focus(),
      getEditor: () => editor,
      markPending: (from, to) => {
        if (!editor) return
        editor
          .chain()
          .setTextSelection({ from, to })
          .setMark('pendingEdit')
          .run()
      },
      clearPending: () => {
        if (!editor) return
        const { doc } = editor.state
        editor
          .chain()
          .setTextSelection({ from: 0, to: doc.content.size })
          .unsetMark('pendingEdit')
          .run()
      },
      replaceSelectionWithText: (text, citations) => {
        if (!editor) return
        applyTextReplacement(editor, text, citations, { replaceSelection: true })
      },
      insertTextAt: (pos, text, citations) => {
        if (!editor) return
        editor.chain().setTextSelection({ from: pos, to: pos }).run()
        applyTextReplacement(editor, text, citations, { replaceSelection: false })
      },
      markComment: (from, to, threadId) => {
        if (!editor) return
        editor
          .chain()
          .setTextSelection({ from, to })
          .setMark('commentThread', { threadId, resolved: false })
          .run()
      },
      unmarkComment: (threadId) => {
        if (!editor) return
        const { doc } = editor.state
        const ranges: Array<{ from: number; to: number }> = []
        doc.descendants((node, pos) => {
          node.marks.forEach((m) => {
            if (m.type.name === 'commentThread' && m.attrs.threadId === threadId) {
              ranges.push({ from: pos, to: pos + node.nodeSize })
            }
          })
        })
        if (ranges.length === 0) return
        const chain = editor.chain()
        for (const r of ranges) {
          chain.setTextSelection(r).unsetMark('commentThread')
        }
        chain.run()
      },
      scrollToComment: (threadId) => {
        if (!editor) return
        const { doc } = editor.state
        let target: { pos: number } | null = null
        doc.descendants((node, pos) => {
          if (target) return false
          const hit = node.marks.some(
            (m) => m.type.name === 'commentThread' && m.attrs.threadId === threadId
          )
          if (hit) target = { pos }
          return !target
        })
        if (!target) return
        editor.chain().focus().setTextSelection({ from: target.pos, to: target.pos }).run()
        const dom = editor.view.domAtPos(target.pos)
        const element = dom.node instanceof HTMLElement
          ? dom.node
          : dom.node.parentElement
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      },
    }))

    return (
      <div className="h-full w-full overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-10">
          <EditorContent editor={editor} />
        </div>
      </div>
    )
  }
)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function computeAnchor(candidate: { x: number; y: number }) {
  // Keep the popover within the viewport when possible.
  if (typeof window === 'undefined') return candidate
  const popoverWidth = 620
  const popoverHeight = 560
  const margin = 12
  const maxX = window.innerWidth - popoverWidth - margin
  const maxY = window.innerHeight - popoverHeight - margin
  return {
    x: Math.max(margin, Math.min(candidate.x, maxX)),
    y: Math.max(margin, Math.min(candidate.y, maxY)),
  }
}

interface ApplyOptions {
  replaceSelection: boolean
}

function applyTextReplacement(
  editor: Editor,
  text: string,
  citations: CitationData[] | undefined,
  opts: ApplyOptions
) {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (paragraphs.length === 0) return

  const content = paragraphs.map((para) => ({
    type: 'paragraph',
    content: buildInlineContent(para, citations),
  }))

  if (opts.replaceSelection) {
    editor
      .chain()
      .focus()
      .deleteSelection()
      .insertContent(content)
      .run()
  } else {
    editor.chain().focus().insertContent(content).run()
  }
}

/**
 * Convert a paragraph's text into inline nodes, marking any known citation
 * labels as `citation` marks so the lawyer can hover and verify later.
 */
function buildInlineContent(
  paragraph: string,
  citations: CitationData[] | undefined
): Array<Record<string, unknown>> {
  if (!citations || citations.length === 0) {
    return [{ type: 'text', text: paragraph }]
  }
  // Build a regex matching any of the citation labels (escaped).
  const labels = citations.map((c) => c.label).filter(Boolean)
  if (labels.length === 0) return [{ type: 'text', text: paragraph }]
  const escaped = labels.map(escapeRegex).sort((a, b) => b.length - a.length)
  const re = new RegExp(`(${escaped.join('|')})`, 'g')
  const pieces: Array<Record<string, unknown>> = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(paragraph)) !== null) {
    const start = match.index
    const end = start + match[0].length
    if (start > lastIndex) {
      pieces.push({ type: 'text', text: paragraph.slice(lastIndex, start) })
    }
    const cite = citations.find((c) => c.label === match![0])
    pieces.push({
      type: 'text',
      text: match[0],
      marks: [
        {
          type: 'citation',
          attrs: {
            kind: cite?.kind ?? 'norma',
            status: 'unverified' satisfies CitationStatus,
          },
        },
      ],
    })
    lastIndex = end
  }
  if (lastIndex < paragraph.length) {
    pieces.push({ type: 'text', text: paragraph.slice(lastIndex) })
  }
  return pieces
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
