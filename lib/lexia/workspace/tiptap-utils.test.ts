import { describe, it, expect } from 'vitest'
import { docToPlainText, docToOutline } from './tiptap-utils'
import type { TiptapDoc } from './types'

const minimalDoc: TiptapDoc = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Hola' }],
    },
  ],
} as TiptapDoc

describe('docToPlainText', () => {
  it('returns empty for nullish', () => {
    expect(docToPlainText(null)).toBe('')
    expect(docToPlainText(undefined)).toBe('')
  })

  it('flattens paragraph text', () => {
    expect(docToPlainText(minimalDoc)).toBe('Hola')
  })

  it('separates blocks with a single newline (implementation detail of walk)', () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'A' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'B' }] },
      ],
    } as TiptapDoc
    expect(docToPlainText(doc)).toBe('A\nB')
  })
})

describe('docToOutline', () => {
  it('builds markdown-style headings from heading nodes', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Título' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Body' }],
        },
      ],
    } as TiptapDoc
    expect(docToOutline(doc)).toBe('## Título')
  })
})
