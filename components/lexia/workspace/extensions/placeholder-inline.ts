/**
 * PlaceholderInline mark — styles inline `[...]` text as a muted placeholder
 * so lawyers clearly see what's waiting to be filled. When the text is
 * edited the mark is preserved only if it still matches `[...]` shape.
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export const PlaceholderInline = Mark.create({
  name: 'placeholderInline',

  inclusive: false,
  spanning: false,

  parseHTML() {
    return [{ tag: 'span[data-placeholder-inline]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-placeholder-inline': 'true',
        class: 'text-muted-foreground italic',
      }),
      0,
    ]
  },
})
