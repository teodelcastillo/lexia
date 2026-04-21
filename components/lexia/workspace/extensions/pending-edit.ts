/**
 * PendingEdit mark — highlights the range the AI is proposing to replace.
 * The replacement itself is rendered OUT of the document (in the popover)
 * as a diff; we only mark the *current* selection so the lawyer can see
 * exactly what would be replaced while reviewing the proposal.
 *
 * We do NOT persist this mark — it's cleared on accept / reject.
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export const PendingEdit = Mark.create({
  name: 'pendingEdit',

  inclusive: false,
  excludes: '',

  parseHTML() {
    return [{ tag: 'span[data-pending-edit]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-pending-edit': 'true',
        class: 'bg-amber-200/50 dark:bg-amber-400/20 rounded-sm px-0.5',
      }),
      0,
    ]
  },
})
