/**
 * Lexia Workspace - shared types & Zod schemas.
 *
 * The workspace is the new editor-first experience. Documents are stored as
 * Tiptap/ProseMirror JSON and AI interactions are modeled as auditable
 * "edit operations" that the lawyer accepts or rejects.
 */

import { z } from 'zod'

// -----------------------------------------------------------------------------
// Document types supported by the workspace (v1).
// More types will be added as we migrate the old Redactor.
// -----------------------------------------------------------------------------

export const WORKSPACE_DOCUMENT_TYPES = ['demanda', 'contestacion'] as const
export type WorkspaceDocumentType = (typeof WORKSPACE_DOCUMENT_TYPES)[number]

export function isWorkspaceDocumentType(v: string): v is WorkspaceDocumentType {
  return (WORKSPACE_DOCUMENT_TYPES as readonly string[]).includes(v)
}

export const CLIENT_ROLES = ['actor', 'demandado', 'recurrente', 'recurrido'] as const
export type ClientRole = (typeof CLIENT_ROLES)[number]

// -----------------------------------------------------------------------------
// Minimal Tiptap/ProseMirror JSON shape. We keep it permissive on purpose;
// validation on the server uses a coarse schema and deeper checks happen when
// applying edits client-side through the actual editor.
// -----------------------------------------------------------------------------

export const TiptapNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(TiptapNodeSchema).optional(),
    marks: z
      .array(
        z.object({
          type: z.string(),
          attrs: z.record(z.string(), z.unknown()).optional(),
        })
      )
      .optional(),
    text: z.string().optional(),
  })
)

export const TiptapDocSchema = z.object({
  type: z.literal('doc'),
  content: z.array(TiptapNodeSchema).optional(),
})

export type TiptapDoc = z.infer<typeof TiptapDocSchema>

// -----------------------------------------------------------------------------
// Edit operation schema used by /api/lexia/documents/[id]/edit (streamObject).
// The AI returns a single EditOperation describing the change to apply on the
// user's selection (or insertion point). The client renders it as a diff and
// the lawyer accepts, rejects, or picks an alternative.
// -----------------------------------------------------------------------------

export const CitationSchema = z.object({
  /** Human-readable reference, e.g. "CCyCN art. 2560" or "CSJN Fallos 340:1695". */
  label: z.string(),
  /** Citation kind used by the verifier. */
  kind: z.enum(['norma', 'jurisprudencia', 'doctrina']).default('norma'),
  /** Quoted text (optional) */
  quote: z.string().optional(),
})

export const EditOperationSchema = z.object({
  /**
   * 2-6 sentence explanation of what changed and why. Shown to the lawyer
   * in the diff UI. This is the transparency primitive.
   */
  reasoning: z.string().min(1),

  /**
   * Replacement text for the selected range, as PLAIN TEXT with paragraph
   * breaks represented by double newlines. The client turns this into
   * ProseMirror nodes when accepted. We keep it as text (not JSON) because
   * it's smaller, streams well, and is trivial to diff visually.
   */
  replacement: z.string(),

  /** Optional alternative wordings the lawyer can pick instead. */
  alternatives: z.array(z.string()).max(3).optional(),

  /** Citations introduced or relied upon. */
  citations: z.array(CitationSchema).max(12).optional(),

  /**
   * Risks / caveats the lawyer should be aware of before accepting.
   * (e.g. "Requiere verificar vigencia del fallo")
   */
  caveats: z.array(z.string()).max(6).optional(),
})

export type EditOperation = z.infer<typeof EditOperationSchema>
export type Citation = z.infer<typeof CitationSchema>

// -----------------------------------------------------------------------------
// Edit request payload (client -> server)
// -----------------------------------------------------------------------------

export const EditRequestSchema = z.object({
  instruction: z.string().min(1).max(2000),
  mode: z.enum(['selection', 'insert']).default('selection'),
  selection: z
    .object({
      from: z.number().int().nonnegative(),
      to: z.number().int().nonnegative(),
      text: z.string().default(''),
    })
    .optional(),
  /** Context the lawyer selected on the sidebar. */
  context: z
    .object({
      documentIds: z.array(z.string().uuid()).default([]),
      personIds: z.array(z.string().uuid()).default([]),
    })
    .optional(),
})

export type EditRequest = z.infer<typeof EditRequestSchema>

// -----------------------------------------------------------------------------
// Document DTO returned to the client
// -----------------------------------------------------------------------------

export interface WorkspaceDocumentDTO {
  id: string
  documentType: WorkspaceDocumentType | string
  title: string
  content: TiptapDoc
  contentText: string
  caseId: string | null
  clientRole: ClientRole | null
  version: number
  metadata: Record<string, unknown>
  activeContext: {
    documentIds: string[]
    personIds: string[]
  }
  createdAt: string
  updatedAt: string
}
