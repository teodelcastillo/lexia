/**
 * Schemas for the Workspace Agent Mode.
 *
 * The agent mode lets the lawyer hand Lexia a high-level objective
 * ("redactá los hechos y el derecho a partir de estos documentos") and get
 * back a structured PLAN of steps that will be executed one by one. Each
 * step produces a concrete edit operation on the document that the client
 * applies in order. Nothing is ever mutated server-side blindly: the client
 * owns the Tiptap document.
 *
 * Two APIs:
 *  - POST /agent/plan     -> returns an AgentPlan (streamed)
 *  - POST /agent/execute  -> given (plan, stepIndex, current doc)
 *                            returns an AgentStepResult (streamed)
 */

import { z } from 'zod'

// -----------------------------------------------------------------------------
// Step & Plan
// -----------------------------------------------------------------------------

/**
 * Operation kind decides WHERE and HOW the client applies the step output.
 *
 *   - draft_section      : create a NEW section (heading + paragraphs) appended
 *                          at the end, or inserted right before a named heading.
 *   - replace_section    : replace all content between `targetHeading` and the
 *                          next heading of equal-or-higher level.
 *   - insert_after_heading: append paragraphs right after `targetHeading`
 *                          (keeping existing content below intact).
 *   - rewrite_entire     : replace the ENTIRE document content. Requires
 *                          explicit confirmation on the client before applying.
 */
export const AgentStepKindEnum = z.enum([
  'draft_section',
  'replace_section',
  'insert_after_heading',
  'rewrite_entire',
])

export type AgentStepKind = z.infer<typeof AgentStepKindEnum>

export const AgentStepSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(160),
  kind: AgentStepKindEnum,
  /** Heading name that anchors this step (required for replace/insert_after). */
  targetHeading: z.string().optional(),
  /** What the step will produce. 1-3 sentences in Spanish. */
  description: z.string().min(1).max(800),
  /** Estimated word count so the lawyer can gauge scope. */
  expectedWords: z.number().int().positive().max(3000).optional(),
})

export type AgentStep = z.infer<typeof AgentStepSchema>

export const AgentPlanSchema = z.object({
  /** 1-2 sentence summary of what the agent is going to do. */
  summary: z.string().min(1).max(600),
  /** Open assumptions/risks the lawyer should be aware of before running. */
  risks: z.array(z.string()).max(6).default([]),
  steps: z.array(AgentStepSchema).min(1).max(10),
})

export type AgentPlan = z.infer<typeof AgentPlanSchema>

// -----------------------------------------------------------------------------
// Plan request / Step result
// -----------------------------------------------------------------------------

export const AgentPlanRequestSchema = z.object({
  objective: z.string().min(8).max(2000),
  context: z
    .object({
      documentIds: z.array(z.string().uuid()).default([]),
      personIds: z.array(z.string().uuid()).default([]),
    })
    .optional(),
})

export type AgentPlanRequest = z.infer<typeof AgentPlanRequestSchema>

/**
 * Output of a single step. `content` is plain text (paragraphs separated by
 * double newlines); the client turns it into Tiptap paragraphs on apply.
 * `heading` is present when `kind === 'draft_section'` and the agent wants a
 * new heading for the section it just drafted.
 */
export const AgentStepResultSchema = z.object({
  stepId: z.string(),
  kind: AgentStepKindEnum,
  /** New heading text if the step creates a section (otherwise absent). */
  heading: z.string().optional(),
  /** Heading level for a newly drafted section (1-3). */
  headingLevel: z.number().int().min(1).max(3).optional(),
  /** The actual text to apply (paragraphs separated by \n\n). */
  content: z.string(),
  /** Why this content satisfies the step. 2-5 sentences. */
  reasoning: z.string().min(1),
  citations: z
    .array(
      z.object({
        label: z.string(),
        kind: z.enum(['norma', 'jurisprudencia', 'doctrina']).default('norma'),
        quote: z.string().optional(),
      })
    )
    .max(12)
    .default([]),
  caveats: z.array(z.string()).max(6).default([]),
})

export type AgentStepResult = z.infer<typeof AgentStepResultSchema>

export const AgentExecuteRequestSchema = z.object({
  plan: AgentPlanSchema,
  stepIndex: z.number().int().nonnegative(),
  /** The result of each previously executed step, so the AI keeps coherence. */
  previousResults: z
    .array(
      z.object({
        stepId: z.string(),
        kind: AgentStepKindEnum,
        heading: z.string().optional(),
        content: z.string(),
      })
    )
    .default([]),
  context: z
    .object({
      documentIds: z.array(z.string().uuid()).default([]),
      personIds: z.array(z.string().uuid()).default([]),
    })
    .optional(),
  /** Optional: plan id used for audit grouping. Must be unique per plan run. */
  planRunId: z.string().uuid().optional(),
})

export type AgentExecuteRequest = z.infer<typeof AgentExecuteRequestSchema>

// -----------------------------------------------------------------------------
// Stress test
// -----------------------------------------------------------------------------

export const StressFindingSchema = z.object({
  /** Heading label the finding belongs to (or "Documento" if top-level). */
  section: z.string(),
  /** The exact paragraph that was stress-tested. */
  passage: z.string(),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  attacks: z
    .array(
      z.object({
        title: z.string(),
        argument: z.string(),
        citation: z.string().optional(),
      })
    )
    .default([]),
  defenses: z.array(z.string()).default([]),
  suggestedRewrite: z.string().optional(),
})

export type StressFinding = z.infer<typeof StressFindingSchema>

export const StressReportSchema = z.object({
  overall: z.enum(['strong', 'acceptable', 'weak']).default('acceptable'),
  summary: z.string().min(1),
  findings: z.array(StressFindingSchema).default([]),
})

export type StressReport = z.infer<typeof StressReportSchema>
