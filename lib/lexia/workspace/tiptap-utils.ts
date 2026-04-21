/**
 * Lightweight utilities for reading/projecting Tiptap/ProseMirror JSON on
 * the server (no Tiptap dependency). We only need text extraction and a
 * simple structural helper for prompt building.
 */

import type { TiptapDoc } from './types'

type AnyNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: AnyNode[]
  text?: string
}

/** Flatten a Tiptap doc to plain text with paragraph/heading separators. */
export function docToPlainText(doc: TiptapDoc | AnyNode | null | undefined): string {
  if (!doc) return ''
  const lines: string[] = []
  const walk = (node: AnyNode) => {
    if (!node) return
    if (node.type === 'text' && typeof node.text === 'string') {
      lines[lines.length - 1] = (lines[lines.length - 1] ?? '') + node.text
      return
    }
    if (
      node.type === 'paragraph' ||
      node.type === 'heading' ||
      node.type === 'blockquote' ||
      node.type === 'listItem' ||
      node.type === 'bulletList' ||
      node.type === 'orderedList' ||
      node.type === 'doc'
    ) {
      if (node.type !== 'doc') lines.push('')
      for (const child of node.content ?? []) walk(child)
      return
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc as AnyNode)
  return lines.join('\n').trim()
}

/**
 * Build a compact outline of the document so the AI can understand the
 * structure without receiving the full text twice.
 */
export function docToOutline(doc: TiptapDoc | AnyNode | null | undefined): string {
  if (!doc) return ''
  const out: string[] = []
  const walk = (node: AnyNode) => {
    if (node.type === 'heading') {
      const level = Number((node.attrs?.level as number | undefined) ?? 1)
      const txt = (node.content ?? [])
        .map((c) => (c.type === 'text' ? c.text ?? '' : ''))
        .join('')
        .trim()
      if (txt) out.push(`${'#'.repeat(level)} ${txt}`)
    }
    for (const child of node.content ?? []) walk(child)
  }
  walk(doc as AnyNode)
  return out.join('\n')
}
