/**
 * Citation mark — wraps a legal citation (normative or jurisprudential).
 * It carries verification status so the lawyer can see at a glance which
 * citations have been validated against the source and which are pending
 * or flagged.
 *
 * Status legend:
 *   'unverified' : default, shown in amber
 *   'verified'   : green check (hover shows source)
 *   'warning'    : yellow warning (hover explains)
 *   'invalid'    : red (likely hallucinated or outdated)
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export type CitationStatus = 'unverified' | 'verified' | 'warning' | 'invalid'

export const Citation = Mark.create({
  name: 'citation',

  inclusive: false,

  addAttributes() {
    return {
      kind: {
        default: 'norma',
        parseHTML: (el) => el.getAttribute('data-kind') ?? 'norma',
        renderHTML: (attrs) => ({ 'data-kind': attrs.kind }),
      },
      status: {
        default: 'unverified' as CitationStatus,
        parseHTML: (el) => el.getAttribute('data-status') ?? 'unverified',
        renderHTML: (attrs) => ({ 'data-status': attrs.status }),
      },
      source: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-source'),
        renderHTML: (attrs) =>
          attrs.source ? { 'data-source': attrs.source } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-citation]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-citation': 'true',
        class: 'lexia-citation',
      }),
      0,
    ]
  },
})
