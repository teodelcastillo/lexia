/**
 * Client-side resolver that turns an AgentStepResult into concrete Tiptap
 * editor commands. Lives next to the editor because it depends on the
 * Tiptap Editor instance.
 *
 * Four operations:
 *   - draft_section        : append (or prepend) a new heading + paragraphs
 *   - replace_section      : replace everything between `targetHeading`
 *                             and the next heading of equal-or-higher level
 *   - insert_after_heading : insert paragraphs right after `targetHeading`
 *   - rewrite_entire       : replace the whole document (only with confirmation)
 */

import type { Editor } from '@tiptap/core'
import type { AgentStepResult, Citation } from '@/lib/lexia/workspace'
import type { CitationStatus } from './extensions/citation'

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function normalizeForCompare(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLowerCase()
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Locate a heading in the doc by (fuzzy) name. Returns the position info of
 * the heading and of the next heading of equal or higher level, which is
 * what "the section ends here" means for replace/insert operations.
 */
export function findHeadingPosition(
  editor: Editor,
  name: string
): { headingStart: number; headingEnd: number; nextEqualOrHigher: number | null; level: number } | null {
  const target = normalizeForCompare(name)
  const { doc } = editor.state
  type HeadingInfo = { pos: number; end: number; level: number; text: string }
  const headings: HeadingInfo[] = []

  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const level = Number(node.attrs.level ?? 1)
      headings.push({
        pos,
        end: pos + node.nodeSize,
        level,
        text: node.textContent,
      })
    }
  })

  const matchIndex = headings.findIndex((h) => normalizeForCompare(h.text) === target)
  const idx = matchIndex >= 0 ? matchIndex : headings.findIndex((h) => normalizeForCompare(h.text).includes(target))
  if (idx < 0) return null

  const current = headings[idx]
  const nextHigher = headings
    .slice(idx + 1)
    .find((h) => h.level <= current.level)

  return {
    headingStart: current.pos,
    headingEnd: current.end,
    nextEqualOrHigher: nextHigher?.pos ?? null,
    level: current.level,
  }
}

/**
 * Build Tiptap content nodes from an AgentStepResult.
 * Paragraphs are separated by double newlines. If the step has its own
 * heading (draft_section), it is emitted FIRST as a heading node.
 */
export function buildNodesForStep(step: AgentStepResult): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = []

  if (step.heading && step.kind === 'draft_section') {
    const level = step.headingLevel ?? 2
    nodes.push({
      type: 'heading',
      attrs: { level },
      content: [{ type: 'text', text: step.heading }],
    })
  }

  const paragraphs = (step.content ?? '')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)

  for (const para of paragraphs) {
    nodes.push({
      type: 'paragraph',
      content: buildInlineContent(para, step.citations),
    })
  }
  return nodes
}

/**
 * Convert a paragraph to inline nodes, marking any occurrence of a citation
 * label as a citation mark so it can be verified later.
 */
function buildInlineContent(
  paragraph: string,
  citations: Citation[] | undefined
): Array<Record<string, unknown>> {
  if (!citations || citations.length === 0) {
    return [{ type: 'text', text: paragraph }]
  }
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

// -----------------------------------------------------------------------------
// Apply
// -----------------------------------------------------------------------------

export interface ApplyOutcome {
  ok: boolean
  message?: string
  appliedFrom?: number
  appliedTo?: number
}

interface ApplyOptions {
  /** Target heading label for replace_section / insert_after_heading. */
  targetHeading?: string
}

function appendAtEnd(editor: Editor, nodes: Array<Record<string, unknown>>, note?: string): ApplyOutcome {
  const endPos = editor.state.doc.content.size
  editor
    .chain()
    .focus()
    .setTextSelection({ from: endPos, to: endPos })
    .insertContent(nodes)
    .run()
  return { ok: true, appliedFrom: endPos, message: note }
}

export function applyAgentStep(
  editor: Editor,
  step: AgentStepResult,
  opts: ApplyOptions = {}
): ApplyOutcome {
  const nodes = buildNodesForStep(step)
  if (nodes.length === 0) {
    return { ok: false, message: 'El agente no devolvió contenido aplicable.' }
  }

  switch (step.kind) {
    case 'draft_section':
      return appendAtEnd(editor, nodes)

    case 'rewrite_entire':
      editor.chain().focus().setContent({ type: 'doc', content: nodes } as never).run()
      return { ok: true, appliedFrom: 0 }

    case 'insert_after_heading': {
      const heading = opts.targetHeading ?? step.heading
      if (!heading) {
        return appendAtEnd(editor, nodes, 'Sin heading objetivo; agregado al final.')
      }
      const loc = findHeadingPosition(editor, heading)
      if (!loc) {
        return appendAtEnd(editor, nodes, `No encontré "${heading}"; agregado al final.`)
      }
      editor
        .chain()
        .focus()
        .setTextSelection({ from: loc.headingEnd, to: loc.headingEnd })
        .insertContent(nodes)
        .run()
      return { ok: true, appliedFrom: loc.headingEnd }
    }

    case 'replace_section': {
      const heading = opts.targetHeading ?? step.heading
      if (!heading) {
        return appendAtEnd(editor, nodes, 'Sin heading objetivo; agregado al final.')
      }
      const loc = findHeadingPosition(editor, heading)
      if (!loc) {
        return appendAtEnd(editor, nodes, `No encontré "${heading}"; agregado al final.`)
      }
      const from = loc.headingEnd
      const to = loc.nextEqualOrHigher ?? editor.state.doc.content.size
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .deleteSelection()
        .insertContent(nodes)
        .run()
      return { ok: true, appliedFrom: from }
    }
  }

  return { ok: false, message: 'Operación no soportada.' }
}

// -----------------------------------------------------------------------------
// Navigation helpers (used by the stress-test panel)
// -----------------------------------------------------------------------------

/** Scroll to the first occurrence of `needle` and flash-select it. */
export function scrollToPassage(editor: Editor, needle: string): boolean {
  const target = needle.trim().slice(0, 120).toLowerCase()
  if (target.length < 8) return false
  const { doc } = editor.state
  const full = doc.textBetween(0, doc.content.size, '\n').toLowerCase()
  const idx = full.indexOf(target)
  if (idx < 0) return false
  // Map char index back to doc position (approximate via a scan).
  let pos = 0
  let charIdx = 0
  doc.descendants((node, dpos) => {
    if (node.isText && typeof node.text === 'string') {
      const len = node.text.length
      if (idx >= charIdx && idx < charIdx + len) {
        pos = dpos + (idx - charIdx)
        return false
      }
      charIdx += len
    } else if (node.type.name === 'paragraph' || node.type.name === 'heading') {
      charIdx += 1
    }
    return true
  })
  const end = Math.min(pos + target.length, doc.content.size - 1)
  editor
    .chain()
    .focus()
    .setTextSelection({ from: pos, to: end })
    .scrollIntoView()
    .run()
  return true
}
