/**
 * Comment mark — highlights a text range that has one or more comment threads
 * anchored to it. Clicking the highlighted span opens the matching thread in
 * the comments panel.
 *
 * The mark carries the `threadId` to decouple it from the DB row lifecycle
 * (renames/reorders do not affect the highlight). A `resolved` attribute
 * lets us render resolved threads dimmer without removing the mark.
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export const CommentMark = Mark.create({
  name: 'commentThread',

  inclusive: false,
  keepOnSplit: true,

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-thread-id'),
        renderHTML: (attrs) =>
          attrs.threadId ? { 'data-thread-id': attrs.threadId } : {},
      },
      resolved: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-resolved') === 'true',
        renderHTML: (attrs) =>
          attrs.resolved ? { 'data-resolved': 'true' } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-thread]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-comment-thread': 'true',
        class: 'lexia-comment-thread',
      }),
      0,
    ]
  },
})
